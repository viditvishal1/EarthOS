# Security (Phase 8)

## Secret handling

- Server-only env vars — never `NEXT_PUBLIC_*` for provider keys, cron secrets, or database credentials.
- `/api/status` and `/api/v1/providers/health` never echo secret values.
- Structured logging redacts `Authorization`, API keys, and connection strings (`src/lib/observability/logger.ts`).
- Grouped env template: `.env.example` — see `docs/DEPLOYMENT.md`.

## SSRF and URL validation

- `/api/article` and outbound fetches use `src/lib/security/url-validator.ts`.
- Deny private IP ranges, link-local, and metadata endpoints on redirects.
- CCTV/camera URLs must match provider allowlists (`src/lib/cameras/registry.ts`).

## Rate limiting

- Expensive routes (search, graph, entity, analyst, article, research) use in-process or Redis-backed limits.
- Tests: `src/lib/security/rate-limit.test.ts`.

## Auth and RLS

- **Supabase Auth** (Phase 2): session cookies + `profiles` table; migration `008_user_auth_rls.sql`.
- **API guard** (`src/lib/auth/api-guard.ts`): session → bearer `ARGUS_API_SECRET` → dev passthrough.
- Anonymous role cannot write platform tables (`003_secure_base_rls.sql`).
- Owner-scoped CRUD on investigations, watchlists, alert rules, dashboard layouts for `authenticated` role.

## CSP and transport

- Security headers in `next.config.ts`: `X-Frame-Options`, `Referrer-Policy`, HSTS (production builds).
- **CSP report-only** enabled first — promote to enforcing `Content-Security-Policy` after monitoring violations.

## CI release gate

- Unit tests (Vitest), E2E (Playwright), `npm audit --audit-level=high`.
- Permission matrix: `src/lib/auth/api-guard.test.ts`.

## Metrics

- `GET /api/v1/metrics` exposes Prometheus counters only — no PII.

## Backup and restore drill

```bash
DATABASE_URL=postgres://... node scripts/backup-db.mjs backup.sql
node scripts/restore-drill.mjs backup.sql
psql "$DATABASE_URL" < backup.sql   # staging only until verified
```

See `docs/DEPLOYMENT.md` for production cutover and rollback.
