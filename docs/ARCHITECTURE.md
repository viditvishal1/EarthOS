# Argus Architecture (World Monitor transformation — Phase 0–1)

Argus adopts World Monitor **patterns** (panel registry, map layer registry, provider gateway, seed/read cache) without copying AGPL code.

## Runtime stack

- **App:** Next.js 15 App Router, React 19, TypeScript, MapLibre GL
- **Canonical self-host:** Docker Compose — Next.js + PostgreSQL/PostGIS + Valkey + nginx
- **Optional cloud adapters:** Supabase, Upstash/KV, Vercel, R2 (not required for core operation)

## Data flow

```
Provider (public API) → connector fetch → validate → normalize Item
  → content policy trim → Redis LKG cache → API read → panels/map
  → optional Postgres persistence / queue (migrations 004–006)
```

## Key modules

| Path | Role |
|------|------|
| `src/lib/connectors/registry.ts` | Provider auth class, license, schedule, default policy |
| `src/lib/connectors/contracts.ts` | ProviderDefinition + provenance types |
| `src/lib/panels/registry.ts` | Dashboard panel catalog |
| `src/lib/map/LayerRegistry.ts` | Map layer definitions |
| `src/lib/ingest/orchestrator.ts` | Due-provider scheduler (bridges legacy connectors) |
| `src/lib/live/*` | Live seed/read split (flights, ships, CCTV, ISS) |

## API surface

- `GET /api/v1/providers/health` — registry + connector status (no secrets)
- `GET /api/v1/map/viewport` — bbox-bounded map points
- `GET /api/bootstrap` — client hydration bundle

## Phased roadmap

See blueprint package `Argus_WorldMonitor_Blueprint.md` for Phases 2–8 (observations API, OpenSky OAuth, AISStream, auth/alerts, hardening).
