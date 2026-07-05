# Security (Phase 8)

## Secret handling

- Server-only env vars — never `NEXT_PUBLIC_*` for provider keys, cron secrets, or database credentials.
- `/api/status` and `/api/v1/providers/health` never echo secret values.
- Structured logging redacts `Authorization`, API keys, and connection strings (`src/lib/observability/logger.ts`).

## SSRF and URL validation

- `/api/article` and outbound fetches use `src/lib/security/url-validator.ts`.
- Deny private IP ranges, link-local, and metadata endpoints on redirects.
- CCTV/camera URLs must match provider allowlists (`src/lib/cameras/registry.ts`).

## Rate limiting

- Expensive routes (search, graph, entity, analyst, article, research) use in-process or Redis-backed limits.

## RLS

- Anonymous role cannot write platform tables (`003_secure_base_rls.sql`, `002_ontology_search_ops.sql`).
- Alert rules, watchlists, and investigations are service-role only until auth ships.

## CSP

- Configure security headers in `next.config.ts` — restrict iframe/embed sources for camera panels.

## Metrics

- `GET /api/v1/metrics` exposes Prometheus counters only — no PII.

## Restore drill

```bash
DATABASE_URL=postgres://... node scripts/backup-db.mjs backup.sql
psql "$DATABASE_URL" < backup.sql
```
