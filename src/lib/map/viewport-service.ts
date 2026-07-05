import { queryCameras } from "@/lib/cameras/service";
import { fetchFlights, fetchFlightsByBbox } from "@/lib/connectors/aviation";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { getObservations } from "@/lib/observations/service";
import { readSatellitePositionsInBbox } from "@/lib/satellites/store";
import { clusterPoints, filterByViewport, parseViewport, type MapPoint, type ViewportQuery } from "@/lib/maps/viewport";
import type { Item } from "@/lib/types";

function itemsToPoints(items: Item[], module: string): MapPoint[] {
  return items
    .filter((i) => typeof i.lat === "number" && typeof i.lon === "number")
    .map((i) => ({
      id: i.id,
      lat: i.lat!,
      lon: i.lon!,
      label: i.title,
      module,
      heading: typeof i.extra?.heading === "number" ? i.extra.heading : undefined,
      extra: i.extra,
    }));
}

export async function fetchViewportLayers(
  vp: ViewportQuery,
  layers: string[],
): Promise<Record<string, { count: number; points: MapPoint[]; provider: string; partial?: boolean }>> {
  const out: Record<string, { count: number; points: MapPoint[]; provider: string; partial?: boolean }> = {};

  if (layers.includes("flights") || layers.includes("aviation")) {
    const bbox: [number, number, number, number] = [vp.west, vp.south, vp.east, vp.north];
    let items: Item[];
    try {
      items = await fetchFlightsByBbox(bbox, { limit: vp.limit ?? 500 });
    } catch {
      const cached = await readLiveCached<Item[]>("flights:global", {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source: "OpenSky/adsb.lol",
        fallback: [],
      });
      items = cached.data.filter(
        (i) => typeof i.lat === "number" && typeof i.lon === "number"
          && i.lon! >= vp.west && i.lon! <= vp.east && i.lat! >= vp.south && i.lat! <= vp.north,
      );
    }
    const points = filterByViewport(itemsToPoints(items, "aviation"), vp);
    out.flights = { count: points.length, points, provider: "OpenSky/adsb.lol", partial: items.length >= (vp.limit ?? 500) };
  }

  if (layers.includes("events") || layers.includes("news")) {
    const obs = await getObservations({
      bbox: [vp.west, vp.south, vp.east, vp.north],
      limit: vp.limit ?? 300,
    });
    const points = filterByViewport(
      obs.observations
        .filter((o) => typeof o.lat === "number" && typeof o.lng === "number")
        .map((o) => ({
          id: o.id,
          lat: o.lat!,
          lon: o.lng!,
          label: o.title,
          module: "news",
          extra: { source: o.provenance.attribution, clusterId: o.clusterId },
        })),
      vp,
    );
    out.events = { count: points.length, points, provider: "GDELT/ReliefWeb/modules" };
  }

  if (layers.includes("quakes") || layers.includes("earthquakes")) {
    const cached = await readLiveCached<Item[]>("module:earth", {
      ttlSeconds: 600,
      source: "connectors:earth",
      fallback: [],
    });
    const quakes = cached.data.filter((i) => i.tags.includes("earthquake"));
    const points = filterByViewport(itemsToPoints(quakes, "earth"), vp);
    out.quakes = { count: points.length, points, provider: "USGS/EONET" };
  }

  if (layers.includes("satellites")) {
    const bbox: [number, number, number, number] = [vp.west, vp.south, vp.east, vp.north];
    const sat = await readSatellitePositionsInBbox(bbox, vp.limit ?? 200);
    const points = filterByViewport(
      sat.points.map((p) => ({
        id: `sat:${p.noradId}`,
        lat: p.lat,
        lon: p.lng,
        label: p.name,
        module: "space",
        extra: {
          noradId: p.noradId,
          altKm: p.altKm,
          epochAgeHours: p.epochAgeHours,
          stale: p.stale,
        },
      })),
      vp,
    );
    out.satellites = { count: points.length, points, provider: sat.provider, partial: sat.partial };
  }

  if (layers.includes("cctv") || layers.includes("cameras")) {
    const cam = await queryCameras({
      west: vp.west,
      south: vp.south,
      east: vp.east,
      north: vp.north,
      limit: vp.limit ?? 300,
    });
    const points = filterByViewport(
      cam.cameras.map((c) => ({
        id: c.id,
        lat: c.lat,
        lon: c.lng,
        label: c.title,
        module: "live",
        extra: {
          provider: c.provider,
          legalMode: c.legalMode,
          imageUrl: c.imageUrl,
          status: c.status,
          healthReason: c.healthReason,
        },
      })),
      vp,
    );
    out.cameras = { count: points.length, points, provider: cam.source };
  }

  return out;
}

export function parseLayerList(raw: string | null): string[] {
  if (!raw) return ["flights"];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export { parseViewport, clusterPoints };
