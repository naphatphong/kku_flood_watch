-- Building codes from registrar timetables (owner request, 5 Oct 2026): "CP9" → a place. The first
-- signed-in visitor to place an unknown code saves it for everyone, through the server, which
-- checks the place (app/api/building-codes). Admins delete wrong ones; the next visitor re-places it.
create table public.building_codes (
  code text primary key check (code ~ '^[A-Z]{2,3}[0-9]{2}$'),
  building_id text check (building_id ~ '^[nwr][0-9]+$'), -- kku-buildings.json id, null for a map point
  name text not null check (char_length(name) between 1 and 80),
  lng float8 not null,
  lat float8 not null,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.building_codes enable row level security;
create policy "public read" on public.building_codes for select to anon, authenticated using (true);
create policy "admin delete" on public.building_codes for delete to authenticated using (public.is_admin());
