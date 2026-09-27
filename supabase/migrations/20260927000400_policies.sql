-- Row Level Security on every table (PLAN §3). Hiding buttons in the UI is not access control.
-- Report creation, moderation and refresh go through the API with the service role,
-- so most tables expose no client write policy at all.

alter table public.profiles enable row level security;
alter table public.road_nodes enable row level security;
alter table public.road_segments enable row level security;
alter table public.reports enable row level security;
alter table public.report_road_segments enable row level security;
alter table public.votes enable row level security;
alter table public.post_flags enable row level security;
alter table public.rainfall enable row level security;
alter table public.flood_clusters enable row level security;
alter table public.flood_clusters_hourly enable row level security;
alter table public.segment_status enable row level security;
alter table public.admin_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Public map data: anyone can read.
create policy "public read" on public.road_nodes for select to anon, authenticated using (true);
create policy "public read" on public.road_segments for select to anon, authenticated using (true);
create policy "public read" on public.rainfall for select to anon, authenticated using (true);
create policy "public read" on public.flood_clusters for select to anon, authenticated using (true);
create policy "public read" on public.segment_status for select to anon, authenticated using (true);

-- Reports: approved ones are public; owners see their own (pending too); admins see all.
create policy "read approved, own or admin" on public.reports for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());
-- A road post's segments are visible with the post (the subquery applies the reports policy).
create policy "read with report" on public.report_road_segments for select to anon, authenticated
  using (exists (select 1 from public.reports r where r.id = report_id));

-- Profiles: private to the owner and admins. Owners may only change their display name.
create policy "read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Votes: one per user per post, changeable; banned users can't vote.
create policy "read own" on public.votes for select to authenticated using (user_id = auth.uid());
create policy "insert own" on public.votes for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
create policy "update own" on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and not public.is_banned());
create policy "delete own" on public.votes for delete to authenticated using (user_id = auth.uid());

-- Flags: one per user per post; admins read them all for the review queue.
create policy "read own or admin" on public.post_flags for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "insert own" on public.post_flags for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());

-- Admin log: admins read; the API writes it with the service role.
create policy "admin read" on public.admin_logs for select to authenticated using (public.is_admin());

-- flood_clusters_hourly and rate_limits: no client policies (service role only).
