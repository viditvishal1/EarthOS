import type { Item } from "@/lib/types";

export interface FlightProvenance {
  provider: string;
  icao24: string;
  callsign: string | null;
  originCountry?: string;
  origin: string | null;
  destination: string | null;
  route?: string | null;
  routeKnown: boolean;
  plausible?: boolean | null;
  aircraftType?: string | null;
  registration?: string | null;
  inferredAirlinePrefix?: string | null;
  airlineCode?: string | null;
  altitudeM?: number | null;
  baroAltFt?: number | null;
  geomAltFt?: number | null;
  velocityMs?: number | null;
  heading?: number | null;
  track?: number | null;
  trueHeading?: number | null;
  magHeading?: number | null;
  verticalRateFpm?: number | null;
  squawk?: string | null;
  onGround: boolean;
  observedAt: string;
  messageCount?: number | null;
  rssi?: number | null;
  seenSeconds?: number | null;
  seenPosSeconds?: number | null;
  adsbType?: string | null;
  windDirection?: number | null;
  windSpeedKt?: number | null;
  oatC?: number | null;
  tatC?: number | null;
  emergency?: string | null;
  category?: string | null;
  imageUrl?: string | null;
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
  squawk?: string | null;
  verticalRateFpm?: number | null;
  baroAltFt?: number | null;
  geomAltFt?: number | null;
  track?: number | null;
  trueHeading?: number | null;
  magHeading?: number | null;
  messageCount?: number | null;
  rssi?: number | null;
  seenSeconds?: number | null;
  seenPosSeconds?: number | null;
  adsbType?: string | null;
  windDirection?: number | null;
  windSpeedKt?: number | null;
  oatC?: number | null;
  tatC?: number | null;
  emergency?: string | null;
  category?: string | null;
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
    baroAltFt: input.baroAltFt ?? null,
    geomAltFt: input.geomAltFt ?? null,
    velocityMs: input.velocityMs ?? null,
    heading: input.heading ?? input.track ?? null,
    track: input.track ?? input.heading ?? null,
    trueHeading: input.trueHeading ?? null,
    magHeading: input.magHeading ?? null,
    verticalRateFpm: input.verticalRateFpm ?? null,
    squawk: input.squawk ?? null,
    onGround: input.onGround ?? false,
    observedAt: input.observedAt,
    messageCount: input.messageCount ?? null,
    rssi: input.rssi ?? null,
    seenSeconds: input.seenSeconds ?? null,
    seenPosSeconds: input.seenPosSeconds ?? null,
    adsbType: input.adsbType ?? null,
    windDirection: input.windDirection ?? null,
    windSpeedKt: input.windSpeedKt ?? null,
    oatC: input.oatC ?? null,
    tatC: input.tatC ?? null,
    emergency: input.emergency ?? null,
    category: input.category ?? null,
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
