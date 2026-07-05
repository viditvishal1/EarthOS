# Deployment and migration (Phase 7)

Safe path from local dev → staging → production with rollback.

## Profiles

| Profile | Stack | Migrations |
|---------|-------|------------|
| **Local** | `npm run dev` | Optional Supabase cloud or skip |
| **Self-host** | `docker compose up` | Postgres in compose — run all SQL files |
| **Hosted** | Vercel + Supabase + Upstash | Supabase SQL Editor |

## Pre-deploy checklist

```bash
npm run release-gate          # typecheck + unit + build + E2E
node scripts/preflight.mjs    # migrations present, .env.example sane
node scripts/migrate-check.mjs
```

## Migrations (order matters)

Run in Supabase SQL Editor (or `psql`) **before** enabling auth-dependent features:

1. `001_platform_foundation.sql`
2. `002_ontology_search_ops.sql`
3. `003_secure_base_rls.sql`
4. `004_dashboard_panels.sql`
5. `005_observations_tracks.sql`
6. `006_provider_governance.sql`
7. `007_alerts_search_ops.sql`
8. **`008_user_auth_rls.sql`** — profiles, owner-scoped RLS (Phase 2)
9. **`009_org_members.sql`** — org membership, saved-search tenancy (Phase 10)

### Backup before migrate

```bash
DATABASE_URL=postgres://... node scripts/backup-db.mjs pre-migration-$(date +%F).sql
```

### Rollback

```bash
psql "$DATABASE_URL" < pre-migration-YYYY-MM-DD.sql
```

Redeploy the previous Vercel deployment from the dashboard if app code must roll back too.

## Vercel production

1. Link repo `viditvishal1/Argus` (formerly EarthOS).
2. Set env from `.env.example` groups — minimum for live data:
   - `CRON_SECRET`
   - `ARGUS_APP_URL`
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or Vercel KV pair)
   - `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + keys
   - `SUPABASE_SERVICE_KEY`
3. **Redeploy** after every env change (env vars do not hot-reload).
4. Push to `main` — CI runs `test` + `e2e`; Vercel auto-deploys on green.

### Post-deploy validation

```bash
ARGUS_APP_URL=https://your-app.vercel.app npm run staging-parity
ARGUS_APP_URL=... CRON_SECRET=... npm run verify:live-data
```

## Docker self-host

```bash
cp .env.example .env.local
docker compose up --build -d
# Apply migrations against postgres://argus:argus@localhost:5432/argus
curl http://localhost:8080/api/status
```

Services include healthchecks — `docker compose ps` should show `healthy` for postgres and valkey.

## Secrets and headers

- Never commit `.env.local` or service keys.
- Production write APIs require `ARGUS_API_SECRET` bearer or Supabase session (see `src/lib/auth/api-guard.ts`).
- Security headers: `next.config.ts` (CSP report-only, HSTS on production).

## Quota behavior

When storage quotas exceed thresholds (`EARTHOS_QUOTA_*` in `.env.example`), ingestion reduces or pauses — see `src/lib/storage/retention.ts`.

## Cutover notes

- **Dual-read:** bootstrap and module APIs read Redis LKG first; Postgres is additive.
- **Auth cutover:** run migration `008` before requiring sign-in for investigations/watchlists.
- **Feature flags:** `feature_flags` table (migration 007) gates markets metrics and prometheus.

## Health dashboard

| Endpoint | Purpose |
|----------|---------|
| `GET /api/status` | Connectors, Supabase, integrations |
| `GET /api/v1/freshness` | Source staleness / gaps |
| `GET /api/health/redis` | Cache adapter |
| `GET /api/health/live-data` | Cron + cache keys |
| `GET /api/v1/metrics` | Prometheus counters |
