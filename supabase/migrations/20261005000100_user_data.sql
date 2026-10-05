-- What a signed-in visitor keeps (owner request, 5 Oct 2026): saved places and timetable as one
-- JSON document per user. The browser merges it with its own copy: the newer edit wins.
create table public.user_data (
  user_id uuid primary key references public.profiles on delete cascade,
  data jsonb not null default '{}' check (octet_length(data::text) < 200000),
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "own row" on public.user_data for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
