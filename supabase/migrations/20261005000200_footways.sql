-- Campus footpaths for walking routes (owner request, 5 Oct 2026). supabase/seed/footways.sql adds
-- them to the road graph as foot-only segments: only the "walk" vehicle may use them.
alter table public.road_segments add column foot_only boolean not null default false;

-- As in 20260927000700_routing.sql, plus: foot-only segments are walkers only.
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
           (p ->> 'risky_penalty')::float8 as risky_penalty
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
        * (case when r.id is null then 1 else 1 + opt.risky_penalty end) as c
    from public.road_segments s cross join opt
    left join public.segment_status st on st.segment_id = s.id and st.vehicle = opt.vehicle
    left join risky r on r.id = s.id
  )
  select id, source, target, c, case when oneway and not walk then -1 else c end
  from e
  where (walk or not foot_only)
    and (p_plain or not (status = 'blocked' or (avoid_hard and status = 'hard')));
$$;

-- As in 20260927000700_routing.sql, plus `foot` (a footpath) on each segment.
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
    group by r.kind, r.path_id
  )
  select jsonb_build_object(
    'safe', coalesce(jsonb_agg(path order by path_id) filter (where kind = 'safe'), '[]'),
    'plain', (jsonb_agg(path) filter (where kind = 'plain')) -> 0)
  from paths;
$$;
