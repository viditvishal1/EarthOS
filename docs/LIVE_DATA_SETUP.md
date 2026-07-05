# Live data pipeline setup

Argus uses a **seed/read split**: schedulers call `GET /api/cron/live` to fetch upstream APIs and write to Upstash Redis; the UI reads from Redis via `GET /api/bootstrap` and domain routes without blocking on external APIs.

**Default scheduler:** Supabase Cron (every 2 minutes). Only one frequent scheduler should normally be active.

## IMPORTANT: rotate compromised secrets

If `CRON_SECRET` was ever exposed (screenshot, chat, git), **rotate it immediately**:

```bash
openssl rand -hex 32
```

Update the new value in:
1. Vercel → `CRON_SECRET`
2. Supabase Vault → `argus_cron_secret`
3. Redeploy Vercel Production

Never use placeholder literals such as `<YOUR_CRON_SECRET>` or `abc123` in curl commands.

## Architecture

```
External APIs
  → GET /api/cron/live  (Authorization: Bearer CRON_SECRET)
  → seedLiveDomains()
  → Upstash Redis  (keys: argus:cache:live:*)
  → GET /api/bootstrap  (Redis read-only)
  → /earth, /dashboard
```

## Vercel Redis variable names

The app accepts **either** naming scheme (UPSTASH preferred):

| Preferred | Vercel Upstash integration fallback |
|-----------|-------------------------------------|
| `UPSTASH_REDIS_REST_URL` | `KV_REST_API_URL` |
| `UPSTASH_REDIS_REST_TOKEN` | `KV_REST_API_TOKEN` |

Never use `KV_REST_API_READ_ONLY_TOKEN` for cache writes.

Health endpoints report the active scheme as `upstash`, `vercel-kv`, or `unconfigured` — never credential values.

## Required Vercel environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| Redis URL + write token | **Yes** | See table above |
| `CRON_SECRET` | **Yes** | `openssl rand -hex 32` |
| `AISHUB_API_KEY` | For vessels | Without it, ships are skipped |
| `WINGBITS_API_KEY` | Optional | Faster global flights |
| `ARGUS_APP_URL` | Workers / docs | e.g. `https://your-app.vercel.app` |

Variables may be set on the Argus project directly or as shared team variables assigned to Argus.

**Changing variables does not update a running deployment.** Redeploy Production after every env change.

## Setup sequence

1. Generate and set `CRON_SECRET` on Vercel (Production + Preview).
2. Ensure Redis URL + writable token are present (`UPSTASH_*` or `KV_*`).
3. **Redeploy** the Vercel project.
4. Verify:

```bash
curl -sS https://<deployment-domain>/api/health/redis
curl -sS https://<deployment-domain>/api/health/live-data
```

5. Warm cache with the **real** secret (never a placeholder):

```bash
export CRON_SECRET='your-actual-secret'
curl -i -H "Authorization: Bearer ${CRON_SECRET}" \
  https://<deployment-domain>/api/cron/live
unset CRON_SECRET
```

6. Automated verification:

```bash
ARGUS_APP_URL=https://<deployment-domain> \
CRON_SECRET='your-actual-secret' \
npm run verify:live-data
```

## Supabase Cron setup

### Enable extensions first

Before querying `cron.job`, enable in Supabase Dashboard:

- **Integrations → Cron** (enables pg_cron), or **Database → Extensions**
- **pg_net**
- **supabase_vault** (Vault)

If extensions are missing, SQL will return `PG_CRON_NOT_INSTALLED` — not `relation "cron.job" does not exist`.

### Preflight

```sql
-- supabase/scripts/check_argus_live_cron.sql
```

### Store Vault secrets (placeholders — replace locally)

```sql
SELECT vault.create_secret('https://<deployment-domain>', 'argus_app_url', 'Argus app URL');
SELECT vault.create_secret('<CRON_SECRET>', 'argus_cron_secret', 'Bearer token for live seed');
```

### Schedule job

```sql
-- supabase/scripts/setup_argus_live_cron.sql
```

### Verify runs

```sql
-- supabase/scripts/verify_argus_live_cron.sql
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| HTTP 401 on `/api/cron/live` | Wrong/missing Bearer token; `CRON_SECRET` not set on Vercel; redeploy after setting |
| `relation "cron.job" does not exist` | Enable pg_cron extension first |
| Redis `configured: false` | Add `UPSTASH_*` or `KV_*` pair; redeploy |
| Redis `reachable: false` | Check Upstash database status / token is writable |
| HTTP 409 | Overlapping seed — normal if cron interval too aggressive |
| Ships `MISSING_AISHUB_API_KEY` | Set `AISHUB_API_KEY` on Vercel |
| Flights empty after warm | Upstream timeout — retry; optional `WINGBITS_API_KEY` |
| Supabase cron runs but HTTP fails | Check `net._http_response`; Vault secret mismatch with Vercel |
| Env changed but app unchanged | **Redeploy Production** |

See also: `docs/DATA_LAYER.md`
