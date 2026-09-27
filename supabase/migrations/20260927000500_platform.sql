-- Supabase platform pieces: photo bucket, realtime, scheduled refresh.
-- Each block is skipped where the feature is missing (e.g. local tests on plain Postgres).

-- Photos are re-encoded by the API (EXIF stripped) before upload; paths are random UUIDs.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- Live pins, circles and road colors (PLAN §8 Realtime).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.reports, public.flood_clusters, public.segment_status;
  end if;
end $$;

-- Every 15 minutes (SCORE.refreshMinutes in lib/config.ts): call the app's refresh endpoint.
-- Needs two Vault secrets, created once by the owner (see SETUP.md):
--   select vault.create_secret('https://<site>/api/cron/refresh', 'refresh_url');
--   select vault.create_secret('<same value as CRON_SECRET on Vercel>', 'cron_secret');
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_namespace where nspname = 'vault') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;

    perform cron.schedule('refresh-flood-data', '*/15 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'refresh_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $job$);

    perform cron.schedule('prune-rate-limits', '17 3 * * *',
      $job$ delete from public.rate_limits where window_start < now() - interval '1 day' $job$);
  end if;
end $$;
