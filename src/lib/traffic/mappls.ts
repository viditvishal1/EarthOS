// Mappls (MapMyIndia) traffic — India-only, key-gated.
//
// Probes route_traffic vs route_adv pairs across the viewport to build
// congestion-colored polylines compatible with the City Twin map overlay.

import { fetchWithTimeout } from "@/lib/connectors/framework";
import type { TrafficBbox, TrafficFlowSegment } from "@/lib/traffic/types";

export function mapplsTrafficEnabled(): boolean {
  return Boolean(getMapplsKey());
}

export function getMapplsKey(): string | undefined {
  return process.env.MAPPLS_API_KEY?.trim() || process.env.MAPMYINDIA_API_KEY?.trim() || undefined;
}

interface MapplsRoute {
  geometry?: GeoJSON.LineString | string;
  distance?: number;
  duration?: number;
  legs?: { summary?: string; distance?: number; duration?: number }[];
}

function coordsFromGeometry(geometry: MapplsRoute["geometry"]): [number, number][] {
  if (!geometry) return [];
  if (typeof geometry === "object" && geometry.type === "LineString") {
    return geometry.coordinates as [number, number][];
  }
  return [];
}

async function fetchRoute(
  key: string,
  resource: "route_traffic" | "route_adv",
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
): Promise<MapplsRoute | null> {
  const path = `${fromLon},${fromLat};${toLon},${toLat}`;
  const url =
    `https://route.mappls.com/route/direction/${resource}/driving/${path}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.code !== "Ok" || !data?.routes?.[0]) return null;
  return data.routes[0] as MapplsRoute;
}

function speedKmh(distanceM: number, durationS: number): number {
  if (durationS <= 0) return 0;
  return (distanceM / durationS) * 3.6;
}

async function probePair(
  key: string,
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number,
): Promise<TrafficFlowSegment | null> {
  const [traffic, baseline] = await Promise.all([
    fetchRoute(key, "route_traffic", fromLon, fromLat, toLon, toLat),
    fetchRoute(key, "route_adv", fromLon, fromLat, toLon, toLat),
  ]);
  if (!traffic) return null;

  const coords = coordsFromGeometry(traffic.geometry);
  if (coords.length < 2) return null;

  const distance = traffic.distance ?? baseline?.distance ?? 0;
  const trafficDuration = traffic.duration ?? 0;
  const freeDuration = baseline?.duration ?? trafficDuration;
  const currentSpeed = speedKmh(distance, trafficDuration);
  const freeFlowSpeed = speedKmh(distance, freeDuration) || currentSpeed || 40;
  const mid = coords[Math.floor(coords.length / 2)];
  const roadName = traffic.legs
    ?.map((leg) => leg.summary?.trim())
    .filter(Boolean)
    .join(" · ");

  return {
    id: `mappls:${coords[0].join(",")}:${coords[coords.length - 1].join(",")}`,
    provider: "Mappls",
    roadName,
    lat: mid[1],
    lon: mid[0],
    currentSpeed,
    freeFlowSpeed: Math.max(freeFlowSpeed, currentSpeed),
    confidence: baseline ? 0.85 : 0.65,
    coords,
  };
}

export async function fetchMapplsTrafficFlow(bbox: TrafficBbox): Promise<TrafficFlowSegment[]> {
  const key = getMapplsKey();
  if (!key) return [];

  const { minLat, minLon, maxLat, maxLon } = bbox;
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const pairs: [number, number, number, number][] = [
    [midLon, midLat, midLon, maxLat],
    [midLon, midLat, midLon, minLat],
    [midLon, midLat, maxLon, midLat],
    [midLon, midLat, minLon, midLat],
    [midLon, midLat, (midLon + maxLon) / 2, (midLat + maxLat) / 2],
  ];

  const results = await Promise.all(
    pairs.map(([aLon, aLat, bLon, bLat]) => probePair(key, aLon, aLat, bLon, bLat)),
  );
  const byId = new Map<string, TrafficFlowSegment>();
  for (const seg of results) {
    if (seg) byId.set(seg.id, seg);
  }
  return [...byId.values()];
}
