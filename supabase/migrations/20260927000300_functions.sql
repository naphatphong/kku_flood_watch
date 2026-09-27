-- Helpers, triggers and RPCs. Scoring math stays in TypeScript (lib/domain) so every
-- tunable number has one home (lib/config.ts); the database only stores results.

-- Coordinates for the API without parsing EWKB.
alter table public.reports
  add column lng double precision generated always as (st_x(geom)) stored,
  add column lat double precision generated always as (st_y(geom)) stored;
alter table public.flood_clusters
  add column lng double precision generated always as (st_x(center)) stored,
  add column lat double precision generated always as (st_y(center)) stored;

-- ---- Roles -----------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and banned);
$$;

-- ---- Profiles for new sign-ups ---------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Vote and flag counters on reports -------------------------------------

create function public.sync_vote_counts() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint := coalesce(new.report_id, old.report_id);
begin
  update public.reports r set
    still_votes = v.still,
    receded_votes = v.receded,
    last_still_vote_at = v.last_still
  from (
    select count(*) filter (where vote = 'still') as still,
           count(*) filter (where vote = 'receded') as receded,
           max(created_at) filter (where vote = 'still') as last_still
    from public.votes where report_id = rid
  ) v
  where r.id = rid;
  return null;
end $$;

create trigger votes_sync
  after insert or update or delete on public.votes
  for each row execute function public.sync_vote_counts();

create function public.sync_flag_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint := coalesce(new.report_id, old.report_id);
begin
  update public.reports set flag_count = (select count(*) from public.post_flags where report_id = rid)
  where id = rid;
  return null;
end $$;

create trigger flags_sync
  after insert or delete on public.post_flags
  for each row execute function public.sync_flag_count();

-- ---- Rate limiting ----------------------------------------------------------

-- Counts one hit for `p_key` in the current fixed window; true while within `p_max`.
create function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  return n <= p_max;
end $$;

-- ---- Map reads --------------------------------------------------------------

-- Road segments that have a status, inside a bbox, as a GeoJSON FeatureCollection.
create function public.map_segments(p_west float8, p_south float8, p_east float8, p_north float8)
returns jsonb language sql stable set search_path = public, extensions as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(f), '[]'))
  from (
    select jsonb_build_object(
      'type', 'Feature',
      'geometry', st_asgeojson(s.geom, 6)::jsonb,
      'properties', jsonb_build_object('id', s.id, 'name', s.name) || st.statuses
    ) as f
    from public.road_segments s
    join (
      select segment_id, jsonb_object_agg(vehicle, status) as statuses
      from public.segment_status group by segment_id
    ) st on st.segment_id = s.id
    where s.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
  ) q;
$$;

-- Road segments within `p_radius_m` of a point, nearest first (road-post picker).
create function public.segments_near(p_lng float8, p_lat float8, p_radius_m float8)
returns jsonb language sql stable set search_path = public, extensions as $$
  select jsonb_build_object('type', 'FeatureCollection', 'features', coalesce(jsonb_agg(f order by d), '[]'))
  from (
    select st_distance(s.geom::geography, st_setsrid(st_point(p_lng, p_lat), 4326)::geography) as d,
      jsonb_build_object(
        'type', 'Feature',
        'geometry', st_asgeojson(s.geom, 6)::jsonb,
        'properties', jsonb_build_object('id', s.id, 'name', s.name, 'source', s.source,
                                         'target', s.target, 'length_m', s.length_m)
      ) as f
    from public.road_segments s
    where st_dwithin(s.geom::geography, st_setsrid(st_point(p_lng, p_lat), 4326)::geography, p_radius_m)
  ) q;
$$;

-- Ids of segments crossing each area post's circle (used when scoring road status).
create function public.segments_in_circles(p_reports jsonb)
returns table (report_id bigint, segment_id bigint)
language sql stable set search_path = public, extensions as $$
  select (r ->> 'id')::bigint, s.id
  from jsonb_array_elements(p_reports) r
  join public.road_segments s on st_dwithin(
    s.geom::geography,
    st_setsrid(st_point((r ->> 'lng')::float8, (r ->> 'lat')::float8), 4326)::geography,
    (r ->> 'radius_m')::float8
  );
$$;

-- Name of the nearest named road, to label a flood circle.
create function public.nearest_road_name(p_lng float8, p_lat float8, p_max_m float8 default 400)
returns text language sql stable set search_path = public, extensions as $$
  select s.name from public.road_segments s
  where s.name is not null
    and st_dwithin(s.geom::geography, st_setsrid(st_point(p_lng, p_lat), 4326)::geography, p_max_m)
  order by s.geom <-> st_setsrid(st_point(p_lng, p_lat), 4326)
  limit 1;
$$;

-- ---- Refresh writes (service role only) --------------------------------------

create function public.replace_flood_clusters(p_clusters jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.flood_clusters where true;
  insert into public.flood_clusters
    (id, name, center, radius_m, report_ids, report_count, low_factor, base, report, c, final, weight_sum, flooded)
  select x ->> 'id', x ->> 'name',
    st_setsrid(st_point((x ->> 'lng')::float8, (x ->> 'lat')::float8), 4326),
    (x ->> 'radius_m')::int,
    array(select jsonb_array_elements_text(x -> 'report_ids')::bigint),
    jsonb_array_length(x -> 'report_ids'),
    (x ->> 'low_factor')::real, (x ->> 'base')::real, (x ->> 'report')::real, (x ->> 'c')::real,
    (x ->> 'final')::real, (x ->> 'weight_sum')::real, (x ->> 'flooded')::boolean
  from jsonb_array_elements(p_clusters) x;
end $$;

create function public.replace_segment_status(p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.segment_status where true;
  insert into public.segment_status (segment_id, vehicle, status)
  select (x ->> 'segment_id')::bigint, x ->> 'vehicle', x ->> 'status'
  from jsonb_array_elements(p_rows) x;
end $$;

-- Hourly training snapshot; one row per circle per hour.
create function public.snapshot_clusters_hourly(p_rain_score real) returns void
language sql security definer set search_path = public as $$
  insert into public.flood_clusters_hourly
    (ts, cluster_id, center, radius_m, report_count, low_factor, base, report, c, final, rain_score)
  select date_trunc('hour', now()), id, center, radius_m, report_count, low_factor, base, report, c, final, p_rain_score
  from public.flood_clusters
  on conflict (ts, cluster_id) do nothing;
$$;

-- Privileged RPCs are for the server (service role) only.
revoke execute on function public.rate_limit_hit, public.replace_flood_clusters, public.replace_segment_status,
  public.snapshot_clusters_hourly, public.segments_in_circles from public, anon, authenticated;
grant execute on function public.rate_limit_hit, public.replace_flood_clusters, public.replace_segment_status,
  public.snapshot_clusters_hourly, public.segments_in_circles to service_role;
