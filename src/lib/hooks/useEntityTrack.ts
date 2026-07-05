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

/** Fetch or synthesize a route polyline for the selected flight / vessel. */
export function useEntityTrack(selected: Item | null): MapLine[] {
  const [history, setHistory] = useState<{ lat: number; lon: number }[]>([]);
  const key = entityTrackKey(selected);

  useEffect(() => {
    if (!selected || !key) {
      setHistory([]);
      return;
    }

    const kind = detectEntityKind(selected);
    if (kind !== "flight") {
      setHistory([]);
      return;
    }

    const icao = key.replace("flight:", "");
    let alive = true;

    fetch(`/api/v1/tracks/flights/${encodeURIComponent(icao)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        const pts = (data.history ?? []) as FlightHistoryPoint[];
        setHistory(
          pts
            .map((p) => ({
              lat: p.lat,
              lon: p.lng ?? p.lon,
            }))
            .filter((p): p is { lat: number; lon: number } =>
              typeof p.lat === "number" && typeof p.lon === "number",
            ),
        );
      })
      .catch(() => alive && setHistory([]));

    return () => { alive = false; };
  }, [key, selected]);

  return useMemo((): MapLine[] => {
    if (!selected || typeof selected.lat !== "number" || typeof selected.lon !== "number") {
      return [];
    }

    const kind = detectEntityKind(selected);
    const heading =
      (selected.extra?.heading as number | undefined)
      ?? (selected.extra?.cog as number | undefined)
      ?? null;

    const coords = buildEntityTrackLine({
      lat: selected.lat,
      lon: selected.lon,
      heading,
      history,
      projectKm: kind === "flight" ? 120 : 40,
    });

    if (coords.length < 2) return [];

    return [{
      id: `track-${selected.id}`,
      color: entityTrackColor(kind),
      coords,
      width: 2.5,
      dashed: false,
    }];
  }, [selected, history]);
}
