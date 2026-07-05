"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import type { MapLine } from "@/components/MapView";
import { buildEntityTrackLine } from "@/lib/geo/track";
import {
  detectEntityKind,
  entityTrackColor,
  entityTrackKey,
} from "@/lib/entity/detail";

interface FlightHistoryPoint {
  lat?: number;
  lng?: number;
  lon?: number;
  observedAt?: string;
}

interface RouteAirport {
  icao: string;
  lat: number;
  lon: number;
}

interface TrackResponse {
  history?: FlightHistoryPoint[];
  airports?: RouteAirport[];
  route?: { airportCodes?: string; plausible?: boolean } | null;
  aircraft?: { lat?: number; lng?: number; routeKnown?: boolean };
}

/** Fetch route polyline, breadcrumb trail, and planned route for selected flight / vessel. */
export function useEntityTrack(selected: Item | null): MapLine[] {
  const [trackData, setTrackData] = useState<TrackResponse | null>(null);
  const key = entityTrackKey(selected);

  useEffect(() => {
    if (!selected || !key) {
      setTrackData(null);
      return;
    }

    const kind = detectEntityKind(selected);
    if (kind !== "flight") {
      setTrackData(null);
      return;
    }

    const icao = key.replace("flight:", "");
    let alive = true;

    fetch(`/api/v1/tracks/flights/${encodeURIComponent(icao)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setTrackData(data as TrackResponse);
      })
      .catch(() => alive && setTrackData(null));

    return () => { alive = false; };
  }, [key, selected]);

  return useMemo((): MapLine[] => {
    if (!selected || typeof selected.lat !== "number" || typeof selected.lon !== "number") {
      return [];
    }

    const kind = detectEntityKind(selected);
    const color = entityTrackColor(kind);
    const lines: MapLine[] = [];

    const history = (trackData?.history ?? [])
      .map((p) => ({
        lat: p.lat,
        lon: p.lng ?? p.lon,
      }))
      .filter((p): p is { lat: number; lon: number } =>
        typeof p.lat === "number" && typeof p.lon === "number",
      );

    const heading =
      (selected.extra?.heading as number | undefined)
      ?? (selected.extra?.track as number | undefined)
      ?? (selected.extra?.cog as number | undefined)
      ?? null;

    const trailCoords = buildEntityTrackLine({
      lat: selected.lat,
      lon: selected.lon,
      heading,
      history,
      projectKm: kind === "flight" ? 120 : 40,
    });

    if (trailCoords.length >= 2) {
      lines.push({
        id: `track-${selected.id}`,
        color,
        coords: trailCoords,
        width: 2.5,
        dashed: false,
      });
    }

    const airports = trackData?.airports ?? [];
    if (airports.length >= 2) {
      const origin = airports[0];
      const dest = airports[airports.length - 1];
      const routeCoords: [number, number][] = [
        [origin.lon, origin.lat],
        [selected.lon, selected.lat],
        [dest.lon, dest.lat],
      ];
      lines.push({
        id: `route-${selected.id}`,
        color: "#fbbf24",
        coords: routeCoords,
        width: 2,
        dashed: true,
      });
    }

    return lines;
  }, [selected, trackData]);
}
