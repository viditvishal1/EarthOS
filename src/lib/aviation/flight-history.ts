import { cacheGet, cacheSet } from "@/lib/cache/redis";

export interface FlightHistoryPoint {
  lat: number;
  lon: number;
  observedAt: string;
}

const MAX_POINTS = 40;
const TTL_SECONDS = 3600;

function cacheKey(icao24: string): string {
  return `flight-history:${icao24.toLowerCase()}`;
}

function near(a: FlightHistoryPoint, b: FlightHistoryPoint): boolean {
  return Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lon - b.lon) < 0.002;
}

/** Append a position sample and return the rolling breadcrumb trail. */
export async function appendFlightHistory(
  icao24: string,
  point: FlightHistoryPoint,
): Promise<FlightHistoryPoint[]> {
  const key = cacheKey(icao24);
  const existing = (await cacheGet<FlightHistoryPoint[]>(key).catch(() => null)) ?? [];
  const last = existing[existing.length - 1];
  const next =
    last && near(last, point)
      ? existing
      : [...existing, point].slice(-MAX_POINTS);

  if (next !== existing) {
    await cacheSet(key, next, TTL_SECONDS).catch(() => {});
  }
  return next;
}

export async function readFlightHistory(icao24: string): Promise<FlightHistoryPoint[]> {
  return (await cacheGet<FlightHistoryPoint[]>(cacheKey(icao24)).catch(() => null)) ?? [];
}
