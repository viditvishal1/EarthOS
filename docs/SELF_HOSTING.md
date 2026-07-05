# Self-hosting Argus

Reference environment: Docker Compose (zero cloud dependency).

## Quick start

```bash
cp .env.example .env.local
# Set CRON_SECRET, optional provider keys

docker compose up --build
```

- App: http://localhost:3000
- nginx proxy: http://localhost:8080

## Services

| Service | Purpose |
|---------|---------|
| `argus` | Next.js standalone (`output: standalone`) |
| `postgres` | PostGIS — run `supabase/migrations/*.sql` |
| `valkey` | Redis-compatible cache (`VALKEY_URL`) |
| `nginx` | Reverse proxy + SSE buffering disabled |

## Environment

| Variable | Class | Notes |
|----------|-------|-------|
| `DATABASE_URL` | internal | Postgres connection |
| `VALKEY_URL` | internal | Preferred cache URL |
| `KV_REST_API_*` | internal | Upstash adapter (optional) |
| `CRON_SECRET` | server-secret | Protects `/api/cron/live` |
| Provider keys | server-secret | See `docs/DATA_SOURCES.md` |

## Migrations

Apply in order:

1. `001_platform_foundation.sql`
2. `002_ontology_search_ops.sql`
3. `003_secure_base_rls.sql`
4. `004_dashboard_panels.sql`
5. `006_provider_governance.sql`

Verify: `node scripts/preflight.mjs`

## Warm live cache

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/live
```
