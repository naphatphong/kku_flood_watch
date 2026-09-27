-- Flood-avoiding navigation (PLAN §6) on the road graph with pgRouting.
-- The cost factors come from lib/config.ts (ROUTING) through the `p` argument:
--   {"vehicle": "car", "avoid_hard": false, "walk_kmh": 5, "hard_factor": 3,
--    "risky_min": 60, "risky_penalty": 0.5, "k": 3}

-- Nodes in the largest connected piece of the network. Routes start and end on these,
-- so a point next to an isolated service road still gets a route.
alter table public.road_nodes add column routable boolean not null default false;

create function public.mark_routable_nodes() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  update public.road_nodes set routable = false where routable;
  with cc as (
    select node, component from pgr_connectedComponents(
      'select id, source, target, 1::float8 as cost, 1::float8 as reverse_cost from public.road_segments')
  ), main as (
    select component from cc group by component order by count(*) desc limit 1
  )
  update public.road_nodes r set routable = true
  from cc join main using (component) where r.id = cc.node;
  get diagnostics n = row_count;
  return n;
end $$;
select public.mark_routable_nodes(); -- no-op until the roads seed is loaded (the seed calls it again)

-- Edges with their cost for one vehicle (PLAN §6):
--   base = length / speed (seconds); passable or no data ×1, hard ×hard_factor, blocked removed;
--   +risky_penalty inside flood circles with final % >= risky_min; one-way streets can't be
--   driven backwards (walking ignores one-way). `p_plain` = base cost only, nothing removed.
create function public.route_edges(p jsonb, p_plain boolean default false)
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
    select s.id, s.source, s.target, s.oneway, opt.walk, opt.avoid_hard,
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
  where p_plain or not (status = 'blocked' or (avoid_hard and status = 'hard'));
$$;

-- Ordered, oriented segments of pgRouting results. p_rows: [[kind, path_id, seq, edge, node]]
-- where `node` is where the edge is entered. Returns {safe: [path], plain: path | null}, a path
-- being [{id, name, length_m, speed_kmh, status, risky, coords}] in the direction of travel.
create function public.route_paths(p_rows jsonb, p jsonb) returns jsonb
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

-- Route candidates between points (lng/lat pairs: start, optional via points, end).
-- Each point snaps to the nearest routable node. Without via points: pgr_KSP (k paths) on
-- the flood cost plus the plain shortest path; with via points: one path of each kind.
-- Returns {points: [{lng, lat, node}], safe: [path], plain: path | null} (see route_paths).
create function public.route_candidates(p_points jsonb, p jsonb) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare
  v_nodes bigint[];
  v_points jsonb;
  v_safe_sql text := format('select * from public.route_edges(%L::jsonb, false)', p);
  v_plain_sql text := format('select * from public.route_edges(%L::jsonb, true)', p);
  v_safe jsonb;
  v_plain jsonb;
begin
  select array_agg(n.id order by pt.ord),
         jsonb_agg(jsonb_build_object('lng', st_x(n.geom), 'lat', st_y(n.geom), 'node', n.id) order by pt.ord)
  into v_nodes, v_points
  from jsonb_array_elements(p_points) with ordinality pt(v, ord)
  cross join lateral (
    select rn.id, rn.geom from public.road_nodes rn where rn.routable
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
  else
    select jsonb_agg(jsonb_build_array('safe', 1, seq, edge, node)) into v_safe
    from pgr_dijkstraVia(v_safe_sql, v_nodes, directed => true, strict => true)
    where edge > 0;
    select jsonb_agg(jsonb_build_array('plain', 1, seq, edge, node)) into v_plain
    from pgr_dijkstraVia(v_plain_sql, v_nodes, directed => true, strict => true)
    where edge > 0;
  end if;

  return jsonb_build_object('points', v_points)
    || public.route_paths(coalesce(v_safe, '[]') || coalesce(v_plain, '[]'), p);
end $$;

-- Navigation is public (PLAN §3) and only reads public tables; marking nodes is for the loader.
revoke execute on function public.mark_routable_nodes from public, anon, authenticated;
grant execute on function public.mark_routable_nodes to service_role;
