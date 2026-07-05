"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import type { MapBounds } from "@/lib/maps/bbox";

const VIEWPORT_ZOOM_MIN = 2.2;

function pointToFlightItem(p: {
  id: string;
  lat: number;
  lon: number;
  label?: string;
  extra?: Record<string, unknown>;
}): Item {
  const heading = typeof p.extra?.heading === "number" ? p.extra.heading : 0;
  const icao24 = typeof p.extra?.icao24 === "string" ? p.extra.icao24 : p.id.replace(/^flight:/, "");
  return {
    id: p.id,
    module: "aviation",
    connectorId: "opensky_states",
    title: p.label ?? icao24,
    summary: p.label ?? "Aircraft",
    source: "OpenSky/adsb.lol",
    url: `https://globe.adsb.lol/?icao=${icao24}`,
    timestamp: new Date().toISOString(),
    lat: p.lat,
    lon: p.lon,
    tags: ["flight", "viewport"],
    entities: [{ name: p.label ?? icao24, type: "aircraft" }],
    contentPolicy: "metadata_only",
    extra: { ...p.extra, heading, icao24 },
  };
}

/** Fetch flights for the visible map bbox — fast regional coverage when zoomed in. */
export function useViewportFlights(enabled: boolean, bounds: MapBounds | null) {
  const [flights, setFlights] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const active = enabled && bounds != null && bounds.zoom >= VIEWPORT_ZOOM_MIN;

  useEffect(() => {
    if (!active || !bounds) {
      setFlights([]);
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          west: String(bounds.west),
          south: String(bounds.south),
          east: String(bounds.east),
          north: String(bounds.north),
          zoom: String(bounds.zoom),
          layers: "flights",
          limit: "800",
        });
        const res = await fetch(`/api/v1/map/viewport?${params}`);
        if (!res.ok || !alive) return;
        const data = await res.json();
        const points = (data.layers?.flights?.points ?? []) as Array<{
          id: string; lat: number; lon: number; label?: string; extra?: Record<string, unknown>;
        }>;
        if (alive) setFlights(points.map(pointToFlightItem));
      } catch {
        if (alive) setFlights([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 450);

    return () => { alive = false; clearTimeout(t); };
  }, [active, bounds?.west, bounds?.south, bounds?.east, bounds?.north, bounds?.zoom]);

  return { flights, loading, active };
}

export { VIEWPORT_ZOOM_MIN };
