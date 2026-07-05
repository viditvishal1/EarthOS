-- Preflight diagnostics for Argus live-data Supabase Cron
-- Safe to run even when extensions are missing — returns one JSON row.

SELECT jsonb_build_object(
  'pg_cron_installed', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'),
  'pg_net_installed', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'),
  'cron_job_exists', to_regclass('cron.job') IS NOT NULL,
  'cron_job_run_details_exists', to_regclass('cron.job_run_details') IS NOT NULL,
  'net_http_response_exists', to_regclass('net._http_response') IS NOT NULL,
  'vault_available', EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault'),
  'argus_app_url_secret_exists', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'argus_app_url'),
  'argus_cron_secret_exists', EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'argus_cron_secret'),
  'live_seed_job_exists', CASE
    WHEN to_regclass('cron.job') IS NULL THEN false
    ELSE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes')
  END,
  'live_seed_schedule', (
    SELECT schedule FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes' LIMIT 1
  ),
  'live_seed_active', (
    SELECT active FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes' LIMIT 1
  ),
  'checked_at', now()
) AS argus_live_cron_preflight;
