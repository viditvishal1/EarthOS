"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import type { CctvCamera } from "@/lib/live/cctv/types";

export interface GlobeLiveMeta {
  flightsUpdatedAt?: string | null;
  flightsStale?: boolean;
  flightsAgeSeconds?: number | null;
  shipsUpdatedAt?: string | null;
  shipsStale?: boolean;
  shipsCount?: number;
  hydratedMs?: number;
}

interface BootstrapPayload {
  flights?: { global?: Item[]; stale?: boolean; ageSeconds?: number | null; updatedAt?: string | null };
  ships?: { items?: Item[]; stale?: boolean; ageSeconds?: number | null };
  webcams?: { items?: Array<{ id: string; title: string; place?: string; lat?: number; lon?: number; url: string; provider: string }> };
  cctv?: { cameras?: CctvCamera[]; stale?: boolean; cold?: boolean };
  iss?: { lat: number; lon: number; altitudeKm?: number; velocityKmh?: number; timestamp?: string } | null;
  modules?: Record<string, { items?: Item[]; stale?: boolean }>;
  hydratedMs?: number;
}

function webcamToItem(w: {
  id: string; title: string; place?: string; lat?: number; lon?: number; url: string; provider: string;
}): Item | null {
  if (typeof w.lat !== "number" || typeof w.lon !== "number") return null;
  return {
    id: `webcam:${w.id}`,
    module: "live",
    connectorId: "webcams",
    title: w.place ? `${w.title} — ${w.place}` : w.title,
    summary: w.provider,
    source: w.provider,
    timestamp: new Date().toISOString(),
    lat: w.lat,
    lon: w.lon,
    url: w.url,
    tags: ["webcam"],
    entities: [{ name: w.place ?? w.title, type: "location" }],
    contentPolicy: "metadata_only",
  };
}

export function cctvToItem(c: CctvCamera): Item {
  const mins = Math.max(1, Math.round(c.refreshSeconds / 60));
  return {
    id: c.id,
    module: "live",
    connectorId: "cctv",
    title: c.title,
    summary: `Snapshot · updated every ~${mins} min · ${c.region}`,
    source: c.source,
    timestamp: c.lastSeenAt,
    lat: c.lat,
    lon: c.lng,
    url: c.imageUrl,
    tags: ["cctv", "snapshot", c.source],
    entities: [{ name: c.region, type: "location" }],
    contentPolicy: "metadata_only",
    extra: {
      imageUrl: c.imageUrl,
      refreshSeconds: c.refreshSeconds,
      cctvStatus: c.status,
      snapshot: true,
    },
  };
}

export function useGlobeLiveData(region = "global") {
  const [quakes, setQuakes] = useState<Item[]>([]);
  const [events, setEvents] = useState<Item[]>([]);
  const [flights, setFlights] = useState<Item[]>([]);
  const [ships, setShips] = useState<Item[]>([]);
  const [webcams, setWebcams] = useState<Item[]>([]);
  const [cctv, setCctv] = useState<Item[]>([]);
  const [iss, setIss] = useState<Item[]>([]);
  const [meta, setMeta] = useState<GlobeLiveMeta>({});
  const [loading, setLoading] = useState(true);

  const applyBootstrap = useCallback((data: BootstrapPayload) => {
    const earthItems = data.modules?.earth?.items ?? [];
    setQuakes(earthItems.filter((i) => i.tags.includes("earthquake")));
    setEvents(earthItems.filter((i) => typeof i.lat === "number" && !i.tags.includes("earthquake")));

    const newsItems = data.modules?.news?.items ?? [];
    const conflictItems = data.modules?.conflict?.items ?? [];
    setEvents((prev) => [
      ...prev,
      ...newsItems.filter((i) => typeof i.lat === "number"),
      ...conflictItems.filter((i) => typeof i.lat === "number"),
    ]);

    setFlights(data.flights?.global ?? []);
    setShips(data.ships?.items ?? []);
    setWebcams(
      (data.webcams?.items ?? [])
        .map(webcamToItem)
        .filter((x): x is Item => x != null),
    );
    setCctv((data.cctv?.cameras ?? []).map(cctvToItem));

    if (data.iss && typeof data.iss.lat === "number") {
      setIss([{
        id: "iss",
        module: "space",
        connectorId: "iss",
        title: "International Space Station",
        summary: data.iss.altitudeKm != null
          ? `Altitude ${data.iss.altitudeKm.toFixed(0)} km · ${data.iss.velocityKmh?.toFixed(0)} km/h`
          : `Position ${data.iss.lat.toFixed(2)}°, ${data.iss.lon.toFixed(2)}°`,
        source: "wheretheiss.at",
        timestamp: data.iss.timestamp ?? new Date().toISOString(),
        lat: data.iss.lat,
        lon: data.iss.lon,
        tags: ["iss"],
        entities: [{ name: "ISS", type: "satellite" }],
        contentPolicy: "full_cache",
      }]);
    }

    setMeta({
      flightsUpdatedAt: data.flights?.updatedAt ?? null,
      flightsStale: Boolean(data.flights?.stale),
      flightsAgeSeconds: data.flights?.ageSeconds ?? null,
      shipsStale: Boolean(data.ships?.stale),
      shipsCount: data.ships?.items?.length ?? 0,
      hydratedMs: data.hydratedMs,
    });
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok) {
        applyBootstrap(await res.json());
        return;
      }
    } catch {
      /* fallback to individual endpoints */
    }

    const [earthRes, flightRes, shipRes, issRes, webcamRes, cctvRes] = await Promise.allSettled([
      fetch("/api/modules/earth").then((r) => r.json()),
      fetch(`/api/flights?region=${region}`).then((r) => r.json()),
      fetch("/api/ships").then((r) => r.json()),
      fetch("/api/iss").then((r) => r.json()),
      fetch("/api/webcams").then((r) => r.json()),
      fetch("/api/cctv").then((r) => r.json()),
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
      setShips((shipRes.value.items ?? []) as Item[]);
    }
    if (issRes.status === "fulfilled") {
      const d = issRes.value;
      if (typeof d.lat === "number") {
        setIss([{
          id: "iss", module: "space", connectorId: "iss",
          title: "International Space Station",
          summary: `Position ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°`,
          source: "wheretheiss.at", timestamp: d.timestamp ?? new Date().toISOString(),
          lat: d.lat, lon: d.lon, tags: ["iss"],
          entities: [{ name: "ISS", type: "satellite" }],
          contentPolicy: "full_cache",
        }]);
      }
    }
    if (webcamRes.status === "fulfilled") {
      setWebcams(
        ((webcamRes.value.items ?? []) as Array<{ id: string; title: string; place?: string; lat?: number; lon?: number; url: string; provider: string }>)
          .map(webcamToItem)
          .filter((x): x is Item => x != null),
      );
    }
    if (cctvRes.status === "fulfilled") {
      setCctv(((cctvRes.value.cameras ?? []) as CctvCamera[]).map(cctvToItem));
    }
    setLoading(false);
  }, [applyBootstrap, region]);

  useEffect(() => {
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [load]);

  return { quakes, events, flights, ships, webcams, cctv, iss, meta, loading, refresh: load };
}
