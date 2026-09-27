-- Road incident posts (owner request, 27 Sep 2026): accidents, closures, obstacles and road
-- works share the reports table (votes, flags, moderation) with flood posts. They have no
-- water level; closures carry "blocked" passability, so road status and navigation avoid them.
-- Safe to re-run (it was first applied by hand in the SQL Editor).
alter table public.reports
  add column if not exists category text not null default 'flood'
    check (category in ('flood', 'accident', 'closure', 'obstacle', 'roadworks'));
alter table public.reports alter column water_level drop not null;
alter table public.reports drop constraint if exists reports_water_level_flood;
alter table public.reports
  add constraint reports_water_level_flood check ((category = 'flood') = (water_level is not null));
