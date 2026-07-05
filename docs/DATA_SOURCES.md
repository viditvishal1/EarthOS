# Data sources

Authoritative registry: `src/lib/connectors/registry.ts` (derived from `argus_data_source_registry.csv`).

## Default-on (keyless or configured)

| Provider | Env | Policy |
|----------|-----|--------|
| USGS earthquakes | — | metadata |
| NASA EONET | — | metadata |
| GDELT | `GDELT_ENABLE`, `GDELT_DOC_API_URL` | excerpt |
| ReliefWeb RSS | — | excerpt |
| OpenSky (anonymous) | optional `OPENSKY_CLIENT_ID/SECRET` | metadata |
| FAA status / NOTAMs | — | metadata |
| CelesTrak TLE | — | full_cache (SGP4 propagation local) |
| Agency CCTV (TfL/WSDOT/Caltrans/NYC/VicRoads) | see CCTV env toggles | image snapshots only |

## Opt-in (keys required)

| Provider | Env |
|----------|-----|
| NASA FIRMS fires | `NASA_FIRMS_MAP_KEY` |
| UCDP | `UCDP_ACCESS_TOKEN` |
| ACLED | `ACLED_API_KEY`, `ACLED_EMAIL` |
| AISHub | `AISHUB_API_KEY` |
| AISStream | `AISSTREAM_API_KEY` |
| FRED / EIA | `FRED_API_KEY`, `EIA_API_KEY` |
| WSDOT / NYC CCTV | `WSDOT_ACCESS_CODE`, `NYC_511_API_KEY` |

## Off by default (production)

| Provider | Reason |
|----------|--------|
| Yahoo Finance | Undocumented endpoint |
| Wingbits | Freemium / terms unverified |
| Windy Webcams | Commercial freemium |

Never expose server secrets via `NEXT_PUBLIC_*`.
