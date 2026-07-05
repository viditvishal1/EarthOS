# Gap Matrix Status (vs PRD)

Last updated: 2026-07-06 (batch 3).

## Closed in batch 3

| ID | Item | Status |
|----|------|--------|
| G03 | Map layers | **32 layers** — static geo (nuclear, pipelines, cables, ports, chokepoints, volcanoes, spaceports, refineries) + domain layers |
| G08 | Aviation depth | Partial — NOTAM geocoding + major airport hub layer |
| G10 | Health/outbreaks | Partial — WHO DON connector + outbreaks layer |
| G13 | Conflict/health | Partial — outbreaks on map |
| G39 | i18n | Partial — full nav + settings keys in en/hi/ar |
| G41 | Tauri desktop | Scaffold — `desktop/` with Tauri v2 config |
| G47 | Billing | Skeleton — migration `012`, status API, Stripe webhook stub |

## Closed in batch 2

| ID | Item |
|----|------|
| G04, G06, G07, G15–G17, G16, G19, G27, G33, G34, G37, G40 | See prior batch |

## Closed in batch 1

| ID | Item |
|----|------|
| G01, G05, G14, G18, G28, G30, G31, G32, G43, G46 | See prior batch |

## Still open

| ID | Item | Notes |
|----|------|-------|
| G03 | 56 map layers | 32/56 — add Natural Earth overlays, traffic, radar, etc. |
| G08–G12 | Remaining domain depth | Maritime AIS depth, space weather, etc. |
| G39 | Full UI i18n | Module pages still English |
| G41 | Tauri release | Scaffold only — needs signed builds |
| G47 | Billing checkout | Webhook stub only — needs Stripe Checkout UI |

## Migrations

Run through `012_billing.sql` in Supabase.
