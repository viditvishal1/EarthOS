import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { lookupAirport } from "@/lib/connectors/airports";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Single aircraft detail — no fabricated origin/destination/route. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ icao24: string }> },
) {
  const { icao24 } = await ctx.params;
  const id = icao24.toLowerCase();

  const regions = ["global", "europe", "usa", "india", "china", "mideast"] as const;
  let flight: Item | undefined;

  for (const region of regions) {
    const cached = await readLiveCached<Item[]>(`flights:${region}`, {
      ttlSeconds: LIVE_SOFT_TTL.flights,
      source: "OpenSky/adsb.lol",
      fallback: [],
    });
    flight = cached.data.find(
      (i) => i.id === `flight:${id}` || String(i.extra?.icao24 ?? "").toLowerCase() === id,
    );
    if (flight) break;
  }

  if (!flight) {
    return noCacheJson({ error: "not_found", icao24: id }, { status: 404 });
  }

  const prefix = String(flight.extra?.inferredAirlinePrefix ?? "").toUpperCase();
  let nearestAirport = null;
  if (prefix.length === 3 && typeof flight.lat === "number") {
    nearestAirport = await lookupAirport(prefix).catch(() => null);
  }

  return noCacheJson({
    aircraft: {
      icao24: id,
      callsign: flight.title,
      lat: flight.lat,
      lng: flight.lon,
      heading: flight.extra?.heading ?? null,
      altitudeM: flight.extra?.altitudeM ?? null,
      velocityMs: flight.extra?.velocityMs ?? null,
      aircraftType: flight.extra?.aircraftType ?? null,
      registration: flight.extra?.registration ?? null,
      origin: null,
      destination: null,
      routeKnown: false,
      originCountry: flight.extra?.originCountry ?? null,
      observedAt: flight.timestamp,
      provider: flight.source,
    },
    context: {
      inferredAirlinePrefix: flight.extra?.inferredAirlinePrefix ?? null,
      prefixIsAirportIcao: nearestAirport ? false : null,
      note: "Free ADS-B state vectors do not include reliable flight number, aircraft type, or route.",
    },
    airports: nearestAirport ? [nearestAirport] : [],
    history: [],
    fetchedAt: new Date().toISOString(),
  });
}
