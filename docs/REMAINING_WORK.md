# EarthOS — Remaining Work

## Completed (Phases 0–4 platform pass)

### Phase 0
- [x] Audit documentation
- [x] Connector health `unknown` default + circuit breaker
- [x] Streets/traffic label accuracy
- [x] SSRF hardening on `/api/article`
- [x] Rate limits on search, graph, entity, analyst, article, research
- [x] Base schema RLS migration (`003_secure_base_rls.sql`)

### Phase 1
- [x] Config tables + expanded seed (news feeds, countries, categories)
- [x] News connectors config-driven at collect time
- [x] R2 archive with `@aws-sdk/client-s3` + gzip batches
- [x] Ingestion queue writes `ingestion_records` + ontology sync
- [x] Vercel Cron: `/api/cron/ingest`, `/api/cron/cleanup`
- [x] Retention cleanup job
- [x] Admin PATCH `/api/config/sources`
- [x] Background ingestion auto-enabled with service key

### Phase 2
- [x] Hybrid search indexed-first (live fallback opt-in)
- [x] Graph API uses persisted ontology when available
- [x] Analyst uses hybrid search not connector fan-out
- [x] Entity resolution (ticker, ICAO, MMSI, IMO)
- [x] Universal command bar entity routing
- [x] pgvector embedding generator (Gemini)
- [x] Wikidata enrichment helper

### Phase 3
- [x] City traffic layer UI (TomTom key-gated)
- [x] Watchlists API
- [x] Viewport map clustering (existing)

### Phase 4
- [x] Investigation evidence pinning UI
- [x] Cited report export with evidence + notes

## Still requires production configuration

1. Link `SUPABASE_SERVICE_KEY` to **argus** Vercel project (not just shared env)
2. Run migrations `001`, `002`, `003` in Supabase SQL Editor
3. Seed: `POST /api/usage` with `Authorization: Bearer $EARTHOS_ADMIN_SECRET`
4. Optional: `TOMTOM_API_KEY`, R2 credentials, Redis, OpenSearch, ClickHouse

## Future enhancements (post-100% foundation)

- [x] Supabase Auth + owner-scoped RLS (Phase 2, migration 008)
- [x] OpenSearch auto-index pipeline on every ingest (Phase 9)
- [x] AISStream global AIS + map layer fallback (Phase 9)
- [x] Org-scoped saved searches (Phase 10, migration 009)
- ClickHouse production deployment + position writers
- Historical playback UI
- Real-time investigation collaboration
