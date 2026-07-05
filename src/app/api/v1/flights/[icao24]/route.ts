import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { enrichFlight } from "@/lib/aviation/adsb-enrichment";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import type { Item } from "@/lib/types";
import type { FlightProvenance } from "@/lib/aviation/flight-record";

export const dynamic = "force-dynamic";

async function findCachedFlight(icao24: string): Promise<Item | undefined> {
  const regions = ["global", "europe", "usa", "india", "china", "mideast"] as const;
  for (const region of regions) {
    const cached = await readLiveCached<Item[]>(`flights:${region}`, {
      ttlSeconds: LIVE_SOFT_TTL.flights,
      source: "OpenSky/adsb.lol",
      fallback: [],
    });
    const flight = cached.data.find(
      (i) => i.id === `flight:${icao24}` || String(i.extra?.icao24 ?? "").toLowerCase() === icao24,
    );
    if (flight) return flight;
  }
  return undefined;
}

/** Live flight enrichment — adsb.lol telemetry, route lookup, aircraft photo. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ icao24: string }> },
) {
  const { icao24 } = await ctx.params;
  const id = icao24.toLowerCase();
  const cached = await findCachedFlight(id);
  const extra = (cached?.extra ?? {}) as Partial<FlightProvenance>;

  const enrichment = await enrichFlight({
    icao24: id,
    callsign: cached?.title ?? extra.callsign,
    lat: cached?.lat,
    lon: cached?.lon,
    cached: extra,
  });

  return noCacheJson({
    ...enrichment,
    cached: cached
      ? {
          lat: cached.lat,
          lon: cached.lon,
          source: cached.source,
          timestamp: cached.timestamp,
        }
      : null,
  });
}
