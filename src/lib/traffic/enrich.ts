import { fetchWithTimeout } from "@/lib/connectors/framework";
import type { TrafficFlowSegment } from "@/lib/traffic/types";

const g = globalThis as unknown as { __roadNameCache?: Map<string, { at: number; name: string }> };
const cache = (g.__roadNameCache ??= new Map());

async function reverseRoadName(lat: number, lon: number): Promise<string | undefined> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit.name || undefined;

  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json&addressdetails=1&zoom=18`,
      {
        timeoutMs: 8000,
        headers: { "Accept-Language": "en", "User-Agent": "Argus/2.0 (traffic enrichment)" },
      },
    );
    if (!res.ok) return undefined;
    const data = await res.json().catch(() => null);
    const addr = data?.address ?? {};
    const name =
      (addr.road as string | undefined) ??
      (addr.pedestrian as string | undefined) ??
      (addr.footway as string | undefined) ??
      (addr.cycleway as string | undefined);
    if (name) cache.set(key, { at: Date.now(), name });
    return name;
  } catch {
    return undefined;
  }
}

/** Fill missing road names via reverse geocoding at segment midpoints. */
export async function enrichSegmentsWithRoadNames(
  segments: TrafficFlowSegment[],
): Promise<TrafficFlowSegment[]> {
  const needsName = segments.filter((s) => !s.roadName?.trim());
  if (needsName.length === 0) return segments;

  const names = await Promise.all(
    needsName.map((s) => reverseRoadName(s.lat, s.lon)),
  );
  const byId = new Map(needsName.map((s, i) => [s.id, names[i]]));

  return segments.map((s) => {
    if (s.roadName?.trim()) return s;
    const name = byId.get(s.id);
    return name ? { ...s, roadName: name } : s;
  });
}
