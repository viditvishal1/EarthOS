# Argus

**An open intelligence operating system built on public data.**

Argus (formerly EarthOS) lets you search, read, filter, and cross-reference public information — news, cybersecurity feeds, aviation, maritime, space, markets, government data, infrastructure health, and startup signals — entirely inside one interface. Every module renders full readable content in-app, every list is filterable with the same universal filter bar, and every entity is a clickable node in a shared knowledge graph.

Built from [`EarthOS_PRD_v2.md`](./EarthOS_PRD_v2.md). Runs at **$0 infrastructure cost**: every data source is a free public API, most of them keyless.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — fill in keys to unlock gated features
npm run dev                  # http://localhost:3000
```

No keys are required to run. Optional keys in `.env.local`:

| Variable | Unlocks | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | AI Analyst, AI search briefings | https://aistudio.google.com/apikey (free tier) |
| `GEMINI_MODEL` | Model override (default `gemini-2.5-flash`) | — |
| `AISHUB_API_KEY` | Live AIS vessel positions | https://www.aishub.net (free membership) |
| `PRODUCTHUNT_API_TOKEN` | Product Hunt daily launches | https://api.producthunt.com/v2/docs |
| `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` | Persistent article cache + ingest log | https://supabase.com/dashboard |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Redis event bus | https://upstash.com (free tier) |
| `ARGUS_INGEST_SECRET` | Rust connector worker → `/api/ingest` | set any strong secret |
| `ACLED_API_KEY` + `ACLED_EMAIL` | ACLED political-violence events | https://developer.acleddata.com (free) |
| `UCDP_ACCESS_TOKEN` | UCDP georeferenced conflict events | https://ucdp.uu.se/apidocs/ (free) |
| `FRED_API_KEY` | US rates/unemployment series | https://fred.stlouisfed.org/docs/api/api_key.html (free) |
| `EIA_API_KEY` | WTI/Brent oil spot prices | https://www.eia.gov/opendata/register.php (free) |
| `TOMTOM_API_KEY` | Live traffic polylines on the City Twin map | https://developer.tomtom.com (free tier) |

## Modules

| Module | Data sources (all free) |
|---|---|
| Situation Room | Home view — cross-stream convergence scoring surfaces developing situations across modules |
| Global Search | Cross-module search over every connector + Google News RSS + data.gov, with AI briefing |
| Conflict & Crisis | ReliefWeb humanitarian updates (keyless), UCDP + ACLED geolocated events (free keys) on a live map |
| Live Channels | Broadcaster live news TV + operator-published public city webcams + NASA/ISS — officially public streams only |
| Macro Economics | World Bank GDP/inflation/unemployment (keyless), FRED US rates, EIA oil spot |
| Earth View | USGS earthquakes, NASA EONET (wildfires/storms/volcanoes), OpenSky flights, live ISS |
| News Intelligence | 8 outlet RSS feeds + Google News country/category editions — in-app reader with PDF support & cache |
| Cyber Intelligence | NVD CVEs (7-day window), CISA Known Exploited Vulnerabilities, vendor watchlist with highlighting |
| Aviation | Global live flights (OpenSky + adsb.lol fallback), FAA delays, NOTAMs |
| Maritime | AISHub vessels (key-gated), maritime news signals |
| Space | ISS telemetry, orbit globe (CelesTrak TLE + SGP4), solar system view, launches, space weather |
| Markets | Yahoo Finance indices/equities, CoinGecko crypto — in-app price charts |
| Startup Intelligence | GitHub trending, Hacker News, Product Hunt (key-gated) |
| Government & Legal | Federal Register, CourtListener, USPTO patents (PDF in-app), data.gov |
| Infrastructure Monitor | Public Statuspage APIs (GitHub, Cloudflare, Vercel, OpenAI, …) — health board + incident feed |
| City Digital Twin | Open-Meteo weather + air quality, nearby natural events, city news — composite per-city view |
| Knowledge Graph | Entities auto-extracted from every connector; force-directed explorer with neighborhood drill-down |
| AI Analyst | Retrieval-grounded Gemini Q&A with clickable inline citations; predictions always labeled |

## Architecture

```
Next.js 15 (App Router, TypeScript, Tailwind v4)
├── src/lib/connectors/   Connector framework — manifest + collector per source,
│                         per-connector isolation, retry-to-last-good-cache,
│                         content_policy enforcement (full_cache/excerpt/metadata)
├── src/lib/graph.ts      Knowledge graph store — entities + co-occurrence edges
│                         ingested from every connector run
├── src/lib/article-cache.ts  Persistent article cache (in-process + optional Supabase)
├── src/lib/db/               Supabase persistence layer (key-gated)
├── src/lib/events/bus.ts     Event bus (in-process + optional Upstash Redis)
├── src/lib/ai.ts             Gemini layer — retrieval-grounded Q&A + briefings
├── workers/connector-rs/     Rust polling worker → POST /api/ingest
├── src/app/api/          API gateway — module feeds, search, graph, article
│                         extraction, market history, analyst
└── src/app/…             17 module UIs sharing FilterBar, ReaderPane, EntityChip,
                          MapView (MapLibre + CARTO/OSM), ForceGraph (canvas)
```

Design decisions vs. the PRD, made to keep launch at $0 with zero accounts:

- **Storage:** connector caches and the knowledge graph are in-process; bookmarks/watchlists/saved filter views live in `localStorage`. The shapes mirror the PRD's Supabase tables, so swapping in Postgres + RLS is a drop-in change behind `src/lib/saved.ts` and `src/lib/graph.ts`.
- **Rust connectors → TypeScript route handlers:** at prototype volume the polling workload doesn't need a separate Rust service; the connector manifest/lifecycle abstraction is preserved so collectors can be externalized later without touching the UI.
- **AI provider:** Gemini free tier (the PRD left the provider open).

## Legal & content policy

Every connector declares a `content_policy` (`full_cache` / `excerpt_only` / `metadata_only`) which the framework enforces before anything reaches the UI. The news reader extracts article text on demand for transient in-app display (reader-mode style, never persisted) and always keeps the "view original" link. Only public, ToS-compliant sources are used; no private data of any kind. AI-generated speculation is always labeled "AI hypothesis — not a verified forecast."

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # tsc --noEmit
```
