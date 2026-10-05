-- "Avoid traffic" routes (owner request, 5 Oct 2026). The 15-minute refresh matches TomTom's slow
-- and closed roads to road segments (segment_traffic: share of free-flow speed, 0..1; missing = free).
-- Routes then offer a third path: flood-blocked roads removed, travel time stretched by traffic.

create table public.segment_traffic (
  segment_id bigint primary key references public.road_segments on delete cascade,
  level real not null check (level between 0 and 1),
  updated_at timestamptz not null default now()
);
alter table public.segment_traffic enable row level security;
create policy "public read" on public.segment_traffic for select to anon, authenticated using (true);

-- p_lines: [{"level": 0.4, "coords": [[lng, lat], …]}]. A segment takes the slowest line that covers
-- at least 70% of it within 12 m (both directions of a road share the result).
create function public.replace_segment_traffic(p_lines jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  delete from public.segment_traffic where true;
  insert into public.segment_traffic (segment_id, level)
  select s.id, min(l.level)
  from (
    select (x ->> 'level')::real as level,
      st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', x -> 'coords')), 4326) as g
    from jsonb_array_elements(p_lines) x
  ) l
  cross join lateral (select st_buffer(l.g::geography, 12)::geometry as zone) b
  join public.road_segments s on not s.foot_only and s.geom && b.zone
    and st_length(st_intersection(s.geom, b.zone)::geography) >= 0.7 * s.length_m
  group by s.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.replace_segment_traffic from public, anon, authenticated;
grant execute on function public.replace_segment_traffic to service_role;

-- As in 20261005000200_footways.sql, plus `traffic` (p.traffic, p.traffic_min): time / level.
create or replace function public.route_edges(p jsonb, p_plain boolean default false)
returns table (id bigint, source bigint, target bigint, cost float8, reverse_cost float8)
language sql stable set search_path = public, extensions as $$
  with opt as (
    select p ->> 'vehicle' as vehicle,
           (p ->> 'vehicle') = 'walk' as walk,
           coalesce((p ->> 'avoid_hard')::boolean, false) as avoid_hard,
           (p ->> 'walk_kmh')::float8 as walk_kmh,
           (p ->> 'hard_factor')::float8 as hard_factor,
           (p ->> 'risky_min')::float8 as risky_min,
           (p ->> 'risky_penalty')::float8 as risky_penalty,
           coalesce((p ->> 'traffic')::boolean, false) as traffic,
           coalesce((p ->> 'traffic_min')::float8, 0.2) as traffic_min
  ), risky as (
    -- ponytail: the degree box (radius / 100 km) over-covers the circle at this latitude; exact test follows.
    select distinct s.id
    from public.flood_clusters c cross join opt
    join public.road_segments s on s.geom && st_expand(c.center, c.radius_m / 100000.0)
      and st_dwithin(s.geom::geography, c.center::geography, c.radius_m)
    where not p_plain and c.final >= opt.risky_min
  ), e as (
    select s.id, s.source, s.target, s.oneway, s.foot_only, opt.walk, opt.avoid_hard,
      coalesce(st.status, 'unknown') as status,
      s.length_m / ((case when opt.walk then opt.walk_kmh else s.speed_kmh end) / 3.6)
        * (case when not p_plain and st.status = 'hard' then opt.hard_factor else 1 end)
        * (case when r.id is null then 1 else 1 + opt.risky_penalty end)
        -- Slow traffic stretches the time (speed × level); closures count as nearly stopped.
        / (case when opt.traffic and not opt.walk then greatest(coalesce(t.level, 1), opt.traffic_min) else 1 end) as c
    from public.road_segments s cross join opt
    left join public.segment_status st on st.segment_id = s.id and st.vehicle = opt.vehicle
    left join risky r on r.id = s.id
    left join public.segment_traffic t on t.segment_id = s.id
  )
  select id, source, target, c, case when oneway and not walk then -1 else c end
  from e
  where (walk or not foot_only)
    and (p_plain or not (status = 'blocked' or (avoid_hard and status = 'hard')));
$$;

-- As in 20261005000200_footways.sql, plus each segment's traffic level and the `fast` path.
create or replace function public.route_paths(p_rows jsonb, p jsonb) returns jsonb
language sql stable set search_path = public, extensions as $$
  with r as (
    select x ->> 0 as kind, (x ->> 1)::int as path_id, (x ->> 2)::int as seq,
           (x ->> 3)::bigint as edge, (x ->> 4)::bigint as node
    from jsonb_array_elements(p_rows) x
  ), paths as (
    select r.kind, r.path_id, jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'length_m', s.length_m,
      'speed_kmh', s.speed_kmh,
      'foot', s.foot_only,
      'traffic', coalesce(t.level, 1),
      'status', coalesce(st.status, 'unknown'),
      'risky', exists (
        select 1 from public.flood_clusters c
        where c.final >= (p ->> 'risky_min')::float8
          and st_dwithin(s.geom::geography, c.center::geography, c.radius_m)),
      'coords', st_asgeojson(case when r.node = s.source then s.geom else st_reverse(s.geom) end, 6)::jsonb -> 'coordinates'
    ) order by r.seq) as path
    from r
    join public.road_segments s on s.id = r.edge
    left join public.segment_status st on st.segment_id = s.id and st.vehicle = p ->> 'vehicle'
    left join public.segment_traffic t on t.segment_id = s.id
    group by r.kind, r.path_id
  )
  select jsonb_build_object(
    'safe', coalesce(jsonb_agg(path order by path_id) filter (where kind = 'safe'), '[]'),
    'plain', (jsonb_agg(path) filter (where kind = 'plain')) -> 0,
    'fast', (jsonb_agg(path) filter (where kind = 'fast')) -> 0)
  from paths;
$$;

-- As in 20260927000700_routing.sql, plus the traffic-aware `fast` path when there is traffic data
-- (not for walking), and vehicles snap only to road nodes (not footpath-only ones).
-- Returns {points, safe, plain, fast}.
create or replace function public.route_candidates(p_points jsonb, p jsonb) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare
  v_nodes bigint[];
  v_points jsonb;
  v_safe_sql text := format('select * from public.route_edges(%L::jsonb, false)', p);
  v_plain_sql text := format('select * from public.route_edges(%L::jsonb, true)', p);
  v_fast_sql text := format('select * from public.route_edges(%L::jsonb, false)', p || '{"traffic": true}');
  v_traffic boolean := (p ->> 'vehicle') <> 'walk' and exists (select 1 from public.segment_traffic);
  v_safe jsonb;
  v_plain jsonb;
  v_fast jsonb;
begin
  select array_agg(n.id order by pt.ord),
         jsonb_agg(jsonb_build_object('lng', st_x(n.geom), 'lat', st_y(n.geom), 'node', n.id) order by pt.ord)
  into v_nodes, v_points
  from jsonb_array_elements(p_points) with ordinality pt(v, ord)
  cross join lateral (
    select rn.id, rn.geom from public.road_nodes rn
    where rn.routable
      -- Vehicles start and end on a road, not on a footpath only walkers may use.
      and ((p ->> 'vehicle') = 'walk' or exists (
        select 1 from public.road_segments s where (s.source = rn.id or s.target = rn.id) and not s.foot_only))
    order by rn.geom <-> st_setsrid(st_point((pt.v ->> 0)::float8, (pt.v ->> 1)::float8), 4326)
    limit 1
  ) n;

  if v_nodes is null or array_length(v_nodes, 1) < 2 then
    return jsonb_build_object('points', coalesce(v_points, '[]'), 'safe', '[]', 'plain', null);
  end if;

  if array_length(v_nodes, 1) = 2 then
    select jsonb_agg(jsonb_build_array('safe', path_id, path_seq, edge, node)) into v_safe
    from pgr_KSP(v_safe_sql, v_nodes[1], v_nodes[2], coalesce((p ->> 'k')::int, 3), directed => true)
    where edge > 0;
    select jsonb_agg(jsonb_build_array('plain', 1, path_seq, edge, node)) into v_plain
    from pgr_dijkstra(v_plain_sql, v_nodes[1], v_nodes[2], directed => true)
    where edge > 0;
    if v_traffic then
      select jsonb_agg(jsonb_build_array('fast', 1, path_seq, edge, node)) into v_fast
      from pgr_dijkstra(v_fast_sql, v_nodes[1], v_nodes[2], directed => true)
      where edge > 0;
    end if;
  else
    select jsonb_agg(jsonb_build_array('safe', 1, seq, edge, node)) into v_safe
    from pgr_dijkstraVia(v_safe_sql, v_nodes, directed => true, strict => true)
    where edge > 0;
    select jsonb_agg(jsonb_build_array('plain', 1, seq, edge, node)) into v_plain
    from pgr_dijkstraVia(v_plain_sql, v_nodes, directed => true, strict => true)
    where edge > 0;
    if v_traffic then
      select jsonb_agg(jsonb_build_array('fast', 1, seq, edge, node)) into v_fast
      from pgr_dijkstraVia(v_fast_sql, v_nodes, directed => true, strict => true)
      where edge > 0;
    end if;
  end if;

  return jsonb_build_object('points', v_points)
    || public.route_paths(coalesce(v_safe, '[]') || coalesce(v_plain, '[]') || coalesce(v_fast, '[]'), p);
end $$;
