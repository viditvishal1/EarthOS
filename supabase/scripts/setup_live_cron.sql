-- Argus live-data Supabase Cron setup
-- Idempotent: safe to re-run. Uses placeholders — replace before executing.
-- Do NOT commit real credentials to git.

-- =============================================================================
-- 1. Enable extensions (Supabase Dashboard → Database → Extensions, or SQL)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- =============================================================================
-- 2. Store secrets in Vault (NOT in public tables)
-- Replace placeholder values with your deployment URL and CRON_SECRET.
-- =============================================================================

-- Remove previous versions if re-running (Vault secret names must be unique)
DELETE FROM vault.secrets WHERE name IN ('argus_app_url', 'argus_cron_secret');

SELECT vault.create_secret(
  'https://<deployment-domain>',
  'argus_app_url',
  'Argus Vercel deployment URL for live seed cron'
);

SELECT vault.create_secret(
  '<CRON_SECRET>',
  'argus_cron_secret',
  'Bearer token for GET /api/cron/live'
);

-- =============================================================================
-- 3. Unschedule existing job with the same name (prevent duplicates)
-- =============================================================================
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- =============================================================================
-- 4. Schedule HTTP GET every 2 minutes via pg_net
-- Timeout: 120 seconds (route maxDuration is 300s on Pro; adjust if needed)
-- =============================================================================
SELECT cron.schedule(
  'argus-live-seed-every-two-minutes',
  '*/2 * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'argus_app_url')
           || '/api/cron/live',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'argus_cron_secret')
    ),
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

-- =============================================================================
-- 5. Verification queries
-- =============================================================================

-- Confirm job exists
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes';

-- Recent run history
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes')
-- ORDER BY start_time DESC LIMIT 20;

-- HTTP response log
-- SELECT id, status_code, timed_out, error_msg, created FROM net._http_response ORDER BY created DESC LIMIT 20;

-- =============================================================================
-- 6. Unschedule (when replacing or disabling)
-- =============================================================================
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'argus-live-seed-every-two-minutes';
