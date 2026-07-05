import { fetchWithTimeout } from "@/lib/connectors/framework";
import type { FlightProvenance } from "@/lib/aviation/flight-record";

export interface AdsbRouteAirport {
  icao: string;
  iata?: string;
  name: string;
  lat: number;
  lon: number;
  location?: string;
  country?: string;
}

export interface AdsbRoute {
  callsign: string;
  airportCodes: string;
  airportCodesIata?: string;
  airlineCode?: string;
  flightNumber?: string;
  plausible?: boolean;
  airports: AdsbRouteAirport[];
}

export interface FlightEnrichment {
  icao24: string;
  callsign: string | null;
  provenance: Partial<FlightProvenance>;
  route: AdsbRoute | null;
  imageUrl: string | null;
  provider: string;
  fetchedAt: string;
}

interface AdsbAc {
  hex: string;
  type?: string;
  flight?: string;
  r?: string;
  t?: string;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  mag_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  lat?: number;
  lon?: number;
  seen?: number;
  seen_pos?: number;
  messages?: number;
  rssi?: number;
  wd?: number;
  ws?: number;
  oat?: number;
  tat?: number;
  emergency?: string;
  category?: string;
}

interface RouteApiResponse {
  callsign?: string;
  airport_codes?: string;
  _airport_codes_iata?: string;
  airline_code?: string;
  number?: string;
  plausible?: boolean;
  _airports?: Array<{
    icao: string;
    iata?: string;
    name: string;
    lat: number;
    lon: number;
    location?: string;
    countryiso2?: string;
  }>;
}

function ftToM(ft: number): number {
  return ft * 0.3048;
}

function knotsToMs(kn: number): number {
  return kn * 0.514444;
}

function mapAdsbAc(ac: AdsbAc): Partial<FlightProvenance> {
  const baroFt = typeof ac.alt_baro === "number" ? ac.alt_baro : null;
  const geomFt = typeof ac.alt_geom === "number" ? ac.alt_geom : null;
  const altitudeM = baroFt != null ? ftToM(baroFt) : geomFt != null ? ftToM(geomFt) : null;

  return {
    provider: ac.type ?? "adsb.lol",
    icao24: ac.hex,
    callsign: ac.flight?.trim() || null,
    registration: ac.r ?? null,
    aircraftType: ac.t ?? null,
    altitudeM,
    baroAltFt: baroFt,
    geomAltFt: geomFt,
    velocityMs: ac.gs != null ? knotsToMs(ac.gs) : null,
    heading: ac.track ?? ac.true_heading ?? null,
    track: ac.track ?? null,
    trueHeading: ac.true_heading ?? null,
    magHeading: ac.mag_heading ?? null,
    verticalRateFpm: ac.baro_rate ?? ac.geom_rate ?? null,
    squawk: ac.squawk ?? null,
    messageCount: ac.messages ?? null,
    rssi: ac.rssi ?? null,
    seenSeconds: ac.seen ?? null,
    seenPosSeconds: ac.seen_pos ?? null,
    adsbType: ac.type ?? null,
    windDirection: ac.wd ?? null,
    windSpeedKt: ac.ws ?? null,
    oatC: ac.oat ?? null,
    tatC: ac.tat ?? null,
    emergency: ac.emergency && ac.emergency !== "none" ? ac.emergency : null,
    category: ac.category ?? null,
    observedAt: new Date().toISOString(),
  };
}

function mapRoute(data: RouteApiResponse): AdsbRoute | null {
  if (!data.airport_codes || data.airport_codes === "unknown") return null;
  const airports: AdsbRouteAirport[] = (data._airports ?? []).map((a) => ({
    icao: a.icao,
    iata: a.iata,
    name: a.name,
    lat: a.lat,
    lon: a.lon,
    location: a.location,
    country: a.countryiso2,
  }));
  if (airports.length < 2) return null;

  const [origin, destination] = data.airport_codes.split("-");
  return {
    callsign: data.callsign ?? "",
    airportCodes: data.airport_codes,
    airportCodesIata: data._airport_codes_iata,
    airlineCode: data.airline_code,
    flightNumber: data.number,
    plausible: data.plausible,
    airports,
    ...(origin && destination ? { origin, destination } : {}),
  } as AdsbRoute & { origin?: string; destination?: string };
}

export function parseAdsbRoute(data: RouteApiResponse): AdsbRoute | null {
  return mapRoute(data);
}

export async function fetchAdsbAircraft(icao24: string): Promise<Partial<FlightProvenance> | null> {
  const hex = icao24.toLowerCase();
  const res = await fetchWithTimeout(`https://api.adsb.lol/v2/icao/${hex}`, { timeoutMs: 12_000 });
  if (!res.ok) return null;
  const data = await res.json();
  const ac = (data.ac ?? [])[0] as AdsbAc | undefined;
  if (!ac) return null;
  return mapAdsbAc(ac);
}

export async function fetchAdsbRoute(
  callsign: string,
  lat: number,
  lon: number,
): Promise<AdsbRoute | null> {
  const cs = callsign.trim().toUpperCase();
  if (!cs || cs.length < 3) return null;
  const res = await fetchWithTimeout(
    `https://api.adsb.lol/api/0/route/${encodeURIComponent(cs)}/${lat.toFixed(2)}/${lon.toFixed(2)}`,
    { timeoutMs: 12_000 },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as RouteApiResponse;
  return mapRoute(data);
}

export async function fetchAircraftPhoto(
  icao24: string,
  reg?: string | null,
  aircraftType?: string | null,
): Promise<string | null> {
  const hex = icao24.toLowerCase();
  const params = new URLSearchParams();
  if (reg) params.set("reg", reg);
  if (aircraftType) params.set("icaoType", aircraftType);
  const qs = params.toString();
  const res = await fetchWithTimeout(
    `https://api.adsb.lol/0/planespotters_net/hex/${hex}${qs ? `?${qs}` : ""}`,
    { timeoutMs: 10_000 },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error || !data.thumbnail) return null;
  const src = data.thumbnail?.src ?? data.thumbnail;
  return typeof src === "string" ? src : null;
}

export async function enrichFlight(input: {
  icao24: string;
  callsign?: string | null;
  lat?: number | null;
  lon?: number | null;
  cached?: Partial<FlightProvenance>;
}): Promise<FlightEnrichment> {
  const icao24 = input.icao24.toLowerCase();
  const [live, route] = await Promise.all([
    fetchAdsbAircraft(icao24).catch(() => null),
    input.lat != null && input.lon != null && input.callsign
      ? fetchAdsbRoute(input.callsign, input.lat, input.lon).catch(() => null)
      : Promise.resolve(null),
  ]);

  const imageUrl = await fetchAircraftPhoto(
    icao24,
    live?.registration ?? input.cached?.registration,
    live?.aircraftType ?? input.cached?.aircraftType,
  ).catch(() => null);

  const provenance: Partial<FlightProvenance> = {
    ...input.cached,
    ...live,
    icao24,
  };

  if (route) {
    const parts = route.airportCodes.split("-");
    provenance.origin = parts[0] ?? null;
    provenance.destination = parts[1] ?? null;
    provenance.route = route.airportCodesIata ?? route.airportCodes;
    provenance.routeKnown = true;
    provenance.airlineCode = route.airlineCode ?? provenance.airlineCode;
    provenance.plausible = route.plausible ?? null;
  }

  if (imageUrl) provenance.imageUrl = imageUrl;

  return {
    icao24,
    callsign: (live?.callsign ?? input.callsign ?? null)?.trim() || null,
    provenance,
    route,
    imageUrl,
    provider: live ? "adsb.lol" : "cache",
    fetchedAt: new Date().toISOString(),
  };
}
