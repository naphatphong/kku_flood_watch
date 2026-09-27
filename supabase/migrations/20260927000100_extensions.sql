-- PostGIS for geometry, pgRouting for flood-aware navigation (PLAN §6, §8).
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgrouting with schema extensions;
