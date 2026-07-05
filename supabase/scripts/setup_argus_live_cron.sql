-- Argus live-data Supabase Cron setup (idempotent, no real secrets)
-- Run in Supabase SQL Editor AFTER enabling pg_cron, pg_net, and Vault.
-- Store secrets in Vault first (Dashboard or SQL below with placeholders replaced).

DO $$
DECLARE
  pg_cron_installed boolean := false;
  pg_net_installed boolean := false;
  vault_available boolean := false;
  app_url text;
  cron_secret text;
  existing_job_id bigint;
  new_job_id bigint;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO pg_cron_installed;
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') INTO pg_net_installed;
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault') INTO vault_available;

  IF NOT pg_cron_installed THEN
    RAISE EXCEPTION 'PG_CRON_NOT_INSTALLED: Enable pg_cron via Supabase Dashboard → Integrations → Cron or Database → Extensions, then re-run this script.';
  END IF;

  IF NOT pg_net_installed THEN
    RAISE EXCEPTION 'PG_NET_NOT_INSTALLED: Enable pg_net via Database → Extensions, then re-run this script.';
  END IF;

  IF NOT vault_available THEN
    RAISE EXCEPTION 'VAULT_NOT_AVAILABLE: Enable supabase_vault extension, then re-run this script.';
  END IF;

  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'CRON_JOB_RELATION_MISSING: pg_cron extension installed but cron.job relation not found.';
  END IF;

  SELECT decrypted_secret INTO app_url
  FROM vault.decrypted_secrets
  WHERE name = 'argus_app_url'
  LIMIT 1;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'argus_cron_secret'
  LIMIT 1;

  IF app_url IS NULL OR app_url = '' THEN
    RAISE EXCEPTION 'VAULT_SECRET_MISSING: argus_app_url — create via vault.create_secret(''https://<deployment-domain>'', ''argus_app_url'', ''Argus app URL'')';
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'VAULT_SECRET_MISSING: argus_cron_secret — create via vault.create_secret(''<CRON_SECRET>'', ''argus_cron_secret'', ''Bearer token for live seed'')';
  END IF;

  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes';
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
    RAISE NOTICE 'Unscheduled existing job id=%', existing_job_id;
  END IF;

  SELECT cron.schedule(
    'argus-live-seed-every-two-minutes',
    '*/2 * * * *',
    format($cron$
      SELECT net.http_get(
        url := %L,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || %L,
          'User-Agent', 'Supabase-Cron/1.0'
        ),
        timeout_milliseconds := 120000
      );
    $cron$, rtrim(app_url, '/') || '/api/cron/live', cron_secret)
  ) INTO new_job_id;

  RAISE NOTICE 'Scheduled argus-live-seed-every-two-minutes job id=%', new_job_id;
END $$;
