"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item } from "@/lib/types";

export interface GlobeLiveMeta {
  flightsUpdatedAt?: string | null;
  flightsStale?: boolean;
  flightsAgeSeconds?: number | null;
  shipsUpdatedAt?: string | null;
  shipsStale?: boolean;
  shipsCount?: number;
}

export function useGlobeLiveData(region = "global") {
  const [quakes, setQuakes] = useState<Item[]>([]);
  const [events, setEvents] = useState<Item[]>([]);
  const [flights, setFlights] = useState<Item[]>([]);
  const [ships, setShips] = useState<Item[]>([]);
  const [webcams, setWebcams] = useState<Item[]>([]);
  const [iss, setIss] = useState<Item[]>([]);
  const [meta, setMeta] = useState<GlobeLiveMeta>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [earthRes, flightRes, shipRes, issRes, webcamRes] = await Promise.allSettled([
      fetch("/api/modules/earth").then((r) => r.json()),
      fetch(`/api/flights?region=${region}`).then((r) => r.json()),
      fetch("/api/ships").then((r) => r.json()),
      fetch("/api/iss").then((r) => r.json()),
      fetch("/api/webcams").then((r) => r.json()),
    ]);

    if (earthRes.status === "fulfilled") {
      const items = (earthRes.value.items ?? []) as Item[];
      setQuakes(items.filter((i) => i.tags.includes("earthquake")));
      setEvents(items.filter((i) => typeof i.lat === "number" && !i.tags.includes("earthquake")));
    }

    if (flightRes.status === "fulfilled") {
      const d = flightRes.value;
      setFlights((d.items ?? []) as Item[]);
      setMeta((m) => ({
        ...m,
        flightsUpdatedAt: d.updatedAt ?? null,
        flightsStale: Boolean(d.stale),
        flightsAgeSeconds: d.ageSeconds ?? null,
      }));
    }

    if (shipRes.status === "fulfilled") {
      const d = shipRes.value;
      setShips((d.items ?? []) as Item[]);
      setMeta((m) => ({
        ...m,
        shipsUpdatedAt: d.updatedAt ?? null,
        shipsStale: Boolean(d.stale),
        shipsCount: (d.items ?? []).length,
      }));
    }

    if (issRes.status === "fulfilled") {
      const d = issRes.value;
      if (typeof d.lat === "number") {
        setIss([{
          id: "iss",
          module: "space",
          connectorId: "iss",
          title: "International Space Station",
          summary: d.altitudeKm != null
            ? `Altitude ${d.altitudeKm.toFixed(0)} km · ${d.velocityKmh?.toFixed(0)} km/h`
            : `Position ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°`,
          source: "wheretheiss.at",
          timestamp: d.timestamp ?? new Date().toISOString(),
          lat: d.lat,
          lon: d.lon,
          tags: ["iss"],
          entities: [{ name: "ISS", type: "satellite" }],
          contentPolicy: "full_cache",
        }]);
      }
    }

    if (webcamRes.status === "fulfilled") {
      const items = ((webcamRes.value.items ?? []) as Array<{
        id: string; title: string; place?: string; lat?: number; lon?: number; url: string; provider: string;
      }>)
        .filter((w) => typeof w.lat === "number" && typeof w.lon === "number")
        .map((w) => ({
          id: `webcam:${w.id}`,
          module: "live",
          connectorId: "webcams",
          title: w.place ? `${w.title} — ${w.place}` : w.title,
          summary: w.provider,
          source: w.provider,
          timestamp: new Date().toISOString(),
          lat: w.lat!,
          lon: w.lon!,
          url: w.url,
          tags: ["webcam"],
          entities: [{ name: w.place ?? w.title, type: "location" as const }],
          contentPolicy: "metadata_only" as const,
        }));
      setWebcams(items);
    }

    setLoading(false);
  }, [region]);

  useEffect(() => {
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  return { quakes, events, flights, ships, webcams, iss, meta, loading, refresh: load };
}
