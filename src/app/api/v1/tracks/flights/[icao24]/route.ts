import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { enrichFlight } from "@/lib/aviation/adsb-enrichment";
import { appendFlightHistory } from "@/lib/aviation/flight-history";
import type { Item } from "@/lib/types";
import type { FlightProvenance } from "@/lib/aviation/flight-record";

export const dynamic = "force-dynamic";

/** Single aircraft track — live enrichment, route airports, position breadcrumb. */
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

  const extra = (flight?.extra ?? {}) as Partial<FlightProvenance>;
  const positionLat = flight?.lat ?? null;
  const positionLon = flight?.lon ?? null;

  const enrichment = await enrichFlight({
    icao24: id,
    callsign: flight?.title ?? extra.callsign,
    lat: flight?.lat,
    lon: flight?.lon,
    cached: extra,
  });

  const prov = enrichment.provenance;

  let history: { lat: number; lng: number; lon?: number; observedAt: string }[] = [];
  if (typeof positionLat === "number" && typeof positionLon === "number") {
    const trail = await appendFlightHistory(id, {
      lat: positionLat,
      lon: positionLon,
      observedAt: flight?.timestamp ?? new Date().toISOString(),
    });
    history = trail.map((p) => ({ lat: p.lat, lng: p.lon, lon: p.lon, observedAt: p.observedAt }));
  }

  const routeAirports = enrichment.route?.airports ?? [];

  return noCacheJson({
    aircraft: {
      icao24: id,
      callsign: enrichment.callsign ?? flight?.title ?? null,
      lat: positionLat,
      lng: positionLon,
      heading: prov.heading ?? prov.track ?? null,
      altitudeM: prov.altitudeM ?? null,
      baroAltFt: prov.baroAltFt ?? null,
      geomAltFt: prov.geomAltFt ?? null,
      velocityMs: prov.velocityMs ?? null,
      verticalRateFpm: prov.verticalRateFpm ?? null,
      squawk: prov.squawk ?? null,
      aircraftType: prov.aircraftType ?? null,
      registration: prov.registration ?? null,
      origin: prov.origin ?? null,
      destination: prov.destination ?? null,
      route: prov.route ?? null,
      routeKnown: Boolean(prov.routeKnown),
      plausible: prov.plausible ?? null,
      originCountry: prov.originCountry ?? null,
      observedAt: prov.observedAt ?? flight?.timestamp ?? null,
      provider: prov.provider ?? flight?.source ?? null,
      messageCount: prov.messageCount ?? null,
      rssi: prov.rssi ?? null,
      seenSeconds: prov.seenSeconds ?? null,
      windDirection: prov.windDirection ?? null,
      windSpeedKt: prov.windSpeedKt ?? null,
      oatC: prov.oatC ?? null,
      imageUrl: enrichment.imageUrl,
    },
    route: enrichment.route,
    airports: routeAirports,
    history,
    fetchedAt: enrichment.fetchedAt,
  });
}
