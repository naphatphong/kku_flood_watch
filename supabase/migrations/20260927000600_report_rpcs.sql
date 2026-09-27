-- Helpers for creating posts (PLAN §4, §7).

-- A road post's chosen segments: must exist and join end to end into one line.
-- Returns {found, connected, length_m, lng, lat} with the point halfway along the line.
create function public.road_selection(p_ids bigint[]) returns jsonb
language sql stable set search_path = public, extensions as $$
  with merged as (
    select st_linemerge(st_collect(geom)) as g, sum(length_m) as len, count(*) as n
    from public.road_segments where id = any (p_ids)
  ), pt as (
    select m.*, case when geometrytype(g) = 'LINESTRING' then st_lineinterpolatepoint(g, 0.5)
                     else st_pointonsurface(g) end as p
    from merged m
  )
  select jsonb_build_object('found', n, 'connected', coalesce(geometrytype(g) = 'LINESTRING', false),
                            'length_m', len, 'lng', st_x(p), 'lat', st_y(p))
  from pt;
$$;

-- Counts behind the spam rules for one user.
create function public.poster_stats(p_user uuid, p_penalty_days int) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'approved', count(*) filter (where status = 'approved'),
    'rejected', count(*) filter (where status = 'rejected'),
    'penalties', count(*) filter (where status in ('rejected', 'hidden')
                                  and created_at > now() - make_interval(days => p_penalty_days))
  )
  from public.reports where user_id = p_user;
$$;

revoke execute on function public.poster_stats from public, anon, authenticated;
grant execute on function public.poster_stats to service_role;
