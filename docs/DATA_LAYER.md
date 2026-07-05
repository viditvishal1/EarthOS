# Live data layer (World Monitor pattern)

Argus uses a **seed/read split** so the UI never blocks on upstream APIs during page load.

## Architecture

```
Supabase Cron (2 min) ──┐
Rust worker (optional) ─┼──► GET /api/cron/live ──► seedLiveDomains() ──► Upstash Redis
Manual warm ────────────┘         (Bearer CRON_SECRET)

Browser ──► GET /api/bootstrap ──► readLiveCached() ──► milliseconds (Redis read-only)
```

Supabase remains the primary durable backend (auth, RLS, items, ingest). Redis holds only fast-changing cached data.

## Redis keys

All keys are prefixed `argus:cache:` internally.

| Key | Soft TTL | Hard TTL | Source |
|-----|----------|----------|--------|
| `live:flights:{region}` | 180s | 24h | OpenSky / adsb.lol / Wingbits |
| `live:ships:global` | 180s | 24h | AISHub |
| `live:webcams:all` | 24h | 24h | Curated + Windy |
| `live:iss:position` | 120s | 24h | wheretheiss.at |
| `live:module:{name}` | 90s–1h | 24h | Connector bundles |
| `lock:live-seed` | 240s | — | Distributed cron lock |

## Required env (production live data)

1. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — official `@upstash/redis` SDK (JSON in request body, not URL)
2. `CRON_SECRET` — protects `/api/cron/live` via `Authorization: Bearer`
3. `AISHUB_API_KEY` — required for vessel positions
4. Optional: `WINGBITS_API_KEY`, `WINDY_WEBCAMS_API_KEY`, `TOMTOM_API_KEY`

Never use `NEXT_PUBLIC_` for Redis or `CRON_SECRET`.

## Scheduler strategy

| Mode | Scheduler | Config |
|------|-----------|--------|
| **A (default)** | Supabase Cron | `supabase/scripts/setup_live_cron.sql` |
| B | Vercel Cron | Add to `vercel.json` only if plan supports frequency |
| C | Rust worker | `workers/connector-rs` — optional fallback |

See `docs/LIVE_DATA_SETUP.md` for full setup instructions.

## Health endpoints

- `GET /api/health/redis` — configured, reachable, latency (no secrets)
- `GET /api/health/live` — cache state, seed metadata, domain snapshots

## Last-known-good protection

- Bootstrap and `/api/bootstrap` use `readLiveCached()` — never fetch upstream, never write empty arrays
- Cron seeding preserves previous Redis values when upstream returns empty or fails
- `seedEmpty: false` by default for flights and vessels

## Manual warm (after deploy)

```bash
curl -sS -H "Authorization: Bearer <CRON_SECRET>" \
  https://<deployment-domain>/api/cron/live
```

## Bootstrap endpoint

`GET /api/bootstrap` — single hydration call for Earth View / Dashboard (flights, ships, webcams, ISS, module bundles). Returns `stale`, `cold`, `updatedAt`, `ageSeconds`, `source`, `hydratedMs`.
