// TomTom traffic provider abstraction — optional, key-gated.
//
// The flow-segment endpoint returns the single road segment nearest a probe
// point, including its full polyline. We probe a small grid across the
// viewport so the map gets several segments, and keep the geometry so the
// client can draw congestion-colored lines instead of a bare list.

import { fetchWithTimeout } from "@/lib/connectors/framework";

export interface TrafficFlowSegment {
  id: string;
  roadName?: string;
  lat: number;
  lon: number;
  currentSpeed: number;
  freeFlowSpeed: number;
  confidence: number;
  coords: [number, number][]; // [lon, lat] polyline for map rendering
}

export function trafficEnabled(): boolean {
  return Boolean(process.env.TOMTOM_API_KEY);
}

async function probe(key: string, lat: number, lon: number): Promise<TrafficFlowSegment | null> {
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${key}&point=${lat},${lon}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 10000 }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const seg = data?.flowSegmentData;
  const raw = seg?.coordinates?.coordinate as { latitude: number; longitude: number }[] | undefined;
  if (!seg || !raw?.length) return null;

  const coords = raw.map((c): [number, number] => [c.longitude, c.latitude]);
  const mid = raw[Math.floor(raw.length / 2)];
  return {
    // First+last coordinate uniquely identify a segment well enough to dedupe
    // overlapping probes.
    id: `tomtom:${coords[0].join(",")}:${coords[coords.length - 1].join(",")}`,
    lat: mid.latitude,
    lon: mid.longitude,
    currentSpeed: seg.currentSpeed ?? 0,
    freeFlowSpeed: seg.freeFlowSpeed ?? 0,
    confidence: seg.confidence ?? 0.5,
    coords,
  };
}

export async function fetchTrafficFlow(bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number }): Promise<TrafficFlowSegment[]> {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return [];

  const { minLat, minLon, maxLat, maxLon } = bbox;
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  // Center + quarter-offset points: 5 probes per viewport keeps well inside
  // the free tier while giving the map more than one road.
  const points: [number, number][] = [
    [midLat, midLon],
    [(midLat + maxLat) / 2, (midLon + maxLon) / 2],
    [(midLat + maxLat) / 2, (midLon + minLon) / 2],
    [(midLat + minLat) / 2, (midLon + maxLon) / 2],
    [(midLat + minLat) / 2, (midLon + minLon) / 2],
  ];

  const results = await Promise.all(points.map(([lat, lon]) => probe(key, lat, lon)));
  const byId = new Map<string, TrafficFlowSegment>();
  for (const seg of results) {
    if (seg) byId.set(seg.id, seg);
  }
  return [...byId.values()];
}
