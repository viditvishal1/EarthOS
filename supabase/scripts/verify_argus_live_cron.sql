-- Verify Argus live-data Supabase Cron execution history
-- Never returns decrypted Vault secrets. Safe when pg_cron is not installed.

WITH preflight AS (
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_installed
),
jobs AS (
  SELECT j.jobid, j.jobname, j.schedule, j.active
  FROM cron.job j
  WHERE EXISTS (SELECT 1 FROM preflight WHERE pg_cron_installed)
    AND j.jobname = 'argus-live-seed-every-two-minutes'
),
runs AS (
  SELECT d.runid, d.jobid, d.status, d.return_message, d.start_time, d.end_time
  FROM cron.job_run_details d
  WHERE EXISTS (SELECT 1 FROM preflight WHERE pg_cron_installed)
    AND d.jobid IN (SELECT jobid FROM jobs)
  ORDER BY d.start_time DESC
  LIMIT 10
),
http AS (
  SELECT r.id, r.status_code, r.timed_out, r.error_msg,
         left(coalesce(r.content, ''), 500) AS content_preview,
         r.created
  FROM net._http_response r
  WHERE EXISTS (SELECT 1 FROM preflight WHERE pg_cron_installed)
    AND to_regclass('net._http_response') IS NOT NULL
  ORDER BY r.created DESC
  LIMIT 10
)
SELECT jsonb_build_object(
  'pg_cron_installed', (SELECT pg_cron_installed FROM preflight),
  'message', CASE
    WHEN NOT (SELECT pg_cron_installed FROM preflight) THEN 'PG_CRON_NOT_INSTALLED'
    WHEN NOT EXISTS (SELECT 1 FROM jobs) THEN 'LIVE_SEED_JOB_NOT_FOUND'
    ELSE 'OK'
  END,
  'job', (SELECT jsonb_agg(to_jsonb(j)) FROM jobs j),
  'recent_runs', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM runs r),
  'recent_http', (SELECT coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) FROM http h),
  'checked_at', now()
) AS argus_live_cron_verify;
