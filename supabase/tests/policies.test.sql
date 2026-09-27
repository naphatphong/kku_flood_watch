-- RLS, triggers and RPC checks. Run with: npm run test:db
-- Fixed ids: A = admin, B = regular user.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', '{"full_name": "Admin A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', '{"name": "User B"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.reports (id, user_id, kind, geom, radius_m, water_level, status) values
  (1, '00000000-0000-0000-0000-00000000000b', 'area', st_setsrid(st_point(102.8173, 16.4617), 4326), 100, 'knee', 'approved'),
  (2, '00000000-0000-0000-0000-00000000000b', 'area', st_setsrid(st_point(102.8180, 16.4620), 4326), 50, 'ankle', 'pending'),
  (3, '00000000-0000-0000-0000-00000000000a', 'area', st_setsrid(st_point(102.8190, 16.4630), 4326), 80, 'dry', 'approved');

do $$ begin
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'User B',
    'profile created from sign-up metadata';
  assert (select lng from public.reports where id = 1) = 102.8173, 'generated lng column';
end $$;

-- Anonymous visitors: approved reports only, no profiles.
set role anon;
do $$ begin
  assert (select count(*) from public.reports) = 2, 'anon sees approved reports only';
  assert (select count(*) from public.profiles) = 0, 'anon sees no profiles';
end $$;
reset role;

-- User B: approved + own pending, own profile only, can vote for self only.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.reports) = 3, 'user sees approved and own pending';
  assert (select count(*) from public.profiles) = 1, 'user sees own profile only';
  insert into public.votes (report_id, user_id, vote) values (3, '00000000-0000-0000-0000-00000000000b', 'still');
  begin
    insert into public.votes (report_id, user_id, vote) values (1, '00000000-0000-0000-0000-00000000000a', 'still');
    raise exception 'voting as someone else must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'changing own role must fail';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set display_name = 'B' where id = auth.uid();
  begin
    perform public.rate_limit_hit('x', 60, 5);
    raise exception 'rate_limit_hit must be server-only';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin
  assert (select still_votes from public.reports where id = 3) = 1, 'vote counter synced';
  assert (select last_still_vote_at from public.reports where id = 3) is not null, 'last still vote synced';
end $$;

-- Banned users cannot vote or flag.
update public.profiles set banned = true where id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    insert into public.post_flags (report_id, user_id, reason) values (1, '00000000-0000-0000-0000-00000000000b', 'spam');
    raise exception 'banned user flag must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Admin A sees everything, including logs.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.reports) = 3, 'admin sees all reports';
  assert (select count(*) from public.profiles) = 2, 'admin sees all profiles';
  perform count(*) from public.admin_logs;
end $$;
reset role;

-- Server-side RPCs.
do $$ begin
  assert public.rate_limit_hit('ip:1', 60, 2) and public.rate_limit_hit('ip:1', 60, 2)
    and not public.rate_limit_hit('ip:1', 60, 2), 'third hit in a window is refused';

  insert into public.road_nodes values (1, st_setsrid(st_point(102.8170, 16.4617), 4326)),
                                       (2, st_setsrid(st_point(102.8176, 16.4617), 4326));
  insert into public.road_segments (id, name, source, target, length_m, speed_kmh, geom)
  values (10, 'ถนนทดสอบ', 1, 2, 64, 30, st_makeline(
    st_setsrid(st_point(102.8170, 16.4617), 4326), st_setsrid(st_point(102.8176, 16.4617), 4326)));
  perform public.replace_segment_status('[{"segment_id": 10, "vehicle": "motorcycle", "status": "blocked"}]');
  assert (public.map_segments(102.81, 16.46, 102.82, 16.47) #>> '{features,0,properties,motorcycle}') = 'blocked',
    'map_segments returns statuses';
  assert jsonb_array_length(public.segments_near(102.8173, 16.4618, 50) -> 'features') = 1, 'segments_near';
  assert (select count(*) from public.segments_in_circles('[{"id": 1, "lng": 102.8173, "lat": 16.4617, "radius_m": 100}]')) = 1,
    'segments_in_circles';
  assert public.nearest_road_name(102.8173, 16.4619) = 'ถนนทดสอบ', 'nearest_road_name';

  perform public.replace_flood_clusters('[{"id": "c1", "name": "x", "lng": 102.8173, "lat": 16.4617, "radius_m": 150,
    "report_ids": [1, 3], "low_factor": 1, "base": 50, "report": 85, "c": 0.32, "final": 61.2, "weight_sum": 2, "flooded": true}]');
  assert (select report_count from public.flood_clusters where id = 'c1') = 2, 'replace_flood_clusters';
  perform public.snapshot_clusters_hourly(0.5);
  perform public.snapshot_clusters_hourly(0.5); -- idempotent within the hour
  assert (select count(*) from public.flood_clusters_hourly) = 1, 'hourly snapshot';
end $$;

-- Post helpers.
do $$ declare r jsonb; begin
  insert into public.road_nodes values (3, st_setsrid(st_point(102.8182, 16.4617), 4326));
  insert into public.road_segments (id, source, target, length_m, speed_kmh, geom)
  values (11, 2, 3, 64, 30, st_makeline(st_setsrid(st_point(102.8176, 16.4617), 4326), st_setsrid(st_point(102.8182, 16.4617), 4326))),
         (12, 1, 3, 200, 30, st_makeline(st_setsrid(st_point(102.8170, 16.4640), 4326), st_setsrid(st_point(102.8180, 16.4650), 4326)));
  r := public.road_selection(array[10, 11]);
  assert (r ->> 'connected')::boolean and (r ->> 'length_m')::real = 128 and (r ->> 'found')::int = 2, 'connected road selection';
  assert not (public.road_selection(array[10, 12]) ->> 'connected')::boolean, 'gap is not connected';
  r := public.poster_stats('00000000-0000-0000-0000-00000000000b', 30);
  assert (r ->> 'approved')::int = 1 and (r ->> 'rejected')::int = 0, 'poster stats';
end $$;

-- A post's road links are visible only with the post.
insert into public.report_road_segments values (1, 10), (2, 11);
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  assert (select array_agg(report_id) from public.report_road_segments) = array[1::bigint], 'anon sees links of approved posts only';
end $$;
reset role;

-- Navigation: blocked segments are cut from the safe graph, one-way streets can't be driven backwards.
do $$ declare
  p jsonb := '{"vehicle": "motorcycle", "walk_kmh": 5, "hard_factor": 3, "risky_min": 60, "risky_penalty": 0.5, "k": 3}';
  r jsonb;
begin
  assert public.mark_routable_nodes() = 3, 'test nodes form one network';
  r := public.route_candidates('[[102.8170, 16.4617], [102.8182, 16.4617]]', p);
  assert (select array_agg((x ->> 'id')::int) from jsonb_array_elements(r -> 'safe' -> 0) x) = array[12],
    'safe path avoids the blocked segment';
  assert (select array_agg((x ->> 'id')::int) from jsonb_array_elements(r -> 'plain') x) = array[10, 11],
    'plain path is the shortest';
  assert r #>> '{plain,0,status}' = 'blocked', 'plain path reports what it crosses';

  r := public.route_candidates('[[102.8170, 16.4617], [102.8176, 16.4618], [102.8182, 16.4617]]', p || '{"vehicle": "car"}');
  assert (select array_agg((x ->> 'id')::int) from jsonb_array_elements(r -> 'safe' -> 0) x) = array[10, 11],
    'route through a via point';

  update public.road_segments set oneway = true where id = 11;
  assert (select reverse_cost from public.route_edges(p || '{"vehicle": "car"}') where id = 11) = -1, 'one-way for cars';
  assert (select reverse_cost from public.route_edges(p || '{"vehicle": "walk"}') where id = 11) > 0, 'walkers ignore one-way';
end $$;
