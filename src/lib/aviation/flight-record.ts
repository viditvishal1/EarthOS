import type { Item } from "@/lib/types";

export interface FlightProvenance {
  provider: string;
  icao24: string;
  callsign: string | null;
  originCountry?: string;
  /** Free state vectors do not provide reliable route — never fabricate. */
  origin: null;
  destination: null;
  routeKnown: false;
  aircraftType?: string | null;
  registration?: string | null;
  inferredAirlinePrefix?: string | null;
  altitudeM?: number | null;
  velocityMs?: number | null;
  heading?: number | null;
  onGround: boolean;
  observedAt: string;
}

export function buildFlightItem(input: {
  icao24: string;
  callsign?: string | null;
  originCountry?: string;
  lat: number;
  lon: number;
  altitudeM?: number | null;
  velocityMs?: number | null;
  heading?: number | null;
  onGround?: boolean;
  observedAt: string;
  provider: string;
  sourceUrl: string;
  region: string;
  aircraftType?: string | null;
  registration?: string | null;
}): Item {
  const callsign = (input.callsign ?? "").trim() || input.icao24.toUpperCase();
  const airlinePrefix = callsign.match(/^[A-Z]{2,3}/)?.[0] ?? null;

  const provenance: FlightProvenance = {
    provider: input.provider,
    icao24: input.icao24,
    callsign: callsign || null,
    originCountry: input.originCountry,
    origin: null,
    destination: null,
    routeKnown: false,
    aircraftType: input.aircraftType ?? null,
    registration: input.registration ?? null,
    inferredAirlinePrefix: airlinePrefix,
    altitudeM: input.altitudeM ?? null,
    velocityMs: input.velocityMs ?? null,
    heading: input.heading ?? null,
    onGround: input.onGround ?? false,
    observedAt: input.observedAt,
  };

  const altLabel = input.altitudeM != null ? `${Math.round(input.altitudeM)} m` : "unknown";
  const spdLabel = input.velocityMs != null ? `${Math.round(input.velocityMs * 3.6)} km/h` : "";

  return {
    id: `flight:${input.icao24}`,
    module: "aviation",
    connectorId: "opensky_states",
    title: callsign,
    summary: `${callsign} · alt ${altLabel}${spdLabel ? ` · ${spdLabel}` : ""} · route unknown`,
    source: input.provider,
    url: input.sourceUrl,
    timestamp: input.observedAt,
    lat: input.lat,
    lon: input.lon,
    tags: ["flight", input.region.toLowerCase()],
    region: input.region,
    entities: airlinePrefix
      ? [{ name: airlinePrefix, type: "organization" }, { name: callsign, type: "aircraft" }]
      : [{ name: callsign, type: "aircraft" }],
    contentPolicy: "metadata_only",
    extra: provenance as unknown as Record<string, unknown>,
  };
}
