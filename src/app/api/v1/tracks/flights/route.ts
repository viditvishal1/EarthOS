import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { fetchFlightsByBbox } from "@/lib/connectors/aviation";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseBbox(p: URLSearchParams): [number, number, number, number] | null {
  const west = Number(p.get("west") ?? p.get("minLon"));
  const south = Number(p.get("south") ?? p.get("minLat"));
  const east = Number(p.get("east") ?? p.get("maxLon"));
  const north = Number(p.get("north") ?? p.get("maxLat"));
  if ([west, south, east, north].some((n) => Number.isNaN(n))) return null;
  return [west, south, east, north];
}

/** Viewport flight tracks — route fields omitted when unknown (never fabricated). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const bbox = parseBbox(p);
  const updatedSince = p.get("updatedSince");
  const limit = p.get("limit") ? Number(p.get("limit")) : 500;

  let items: Item[] = [];
  let provider = "OpenSky/adsb.lol";
  let partial = false;

  if (bbox) {
    try {
      items = await fetchFlightsByBbox(bbox, { limit });
    } catch {
      const cached = await readLiveCached<Item[]>("flights:global", {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source: "OpenSky/adsb.lol",
        fallback: [],
      });
      items = cached.data.filter(
        (i) => typeof i.lat === "number" && typeof i.lon === "number"
          && i.lon! >= bbox[0] && i.lon! <= bbox[2] && i.lat! >= bbox[1] && i.lat! <= bbox[3],
      );
      provider = cached.source;
    }
  } else {
    const cached = await readLiveCached<Item[]>("flights:global", {
      ttlSeconds: LIVE_SOFT_TTL.flights,
      source: "OpenSky/adsb.lol",
      fallback: [],
    });
    items = cached.data;
    provider = cached.source;
  }

  if (updatedSince) {
    items = items.filter((i) => i.timestamp >= updatedSince);
  }

  partial = items.length >= limit;

  const tracks = items.slice(0, limit).map((i) => ({
    id: i.id,
    icao24: i.extra?.icao24 ?? i.id.replace("flight:", ""),
    callsign: i.title,
    lat: i.lat,
    lng: i.lon,
    heading: i.extra?.heading ?? null,
    altitudeM: i.extra?.altitudeM ?? null,
    velocityMs: i.extra?.velocityMs ?? null,
    origin: null,
    destination: null,
    routeKnown: false,
    provider: i.source,
    observedAt: i.timestamp,
    provenance: i.extra,
  }));

  return noCacheJson({
    tracks,
    count: tracks.length,
    bbox,
    provider,
    partial,
    coverage: "Global sampled — receiver-dependent",
    fetchedAt: new Date().toISOString(),
  });
}
