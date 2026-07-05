"use client";

import { useCallback, useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import type { CctvCamera } from "@/lib/live/cctv/types";
import { cameraAgencyUrl } from "@/lib/cameras/registry";
import { useSmartPoll } from "@/lib/hooks/useSmartPoll";
import type { LayerData } from "@/lib/maps/layer-catalog";
import { PLATFORM_HQ } from "@/lib/maps/static-geo";

const EMPTY_LAYERS: LayerData = {
  events: [], quakes: [], iss: [], flights: [], ships: [], webcams: [], cctv: [],
  fires: [], advisories: [], sanctions: [], conflicts: [], cyber: [], forecasts: [],
  predictions: [], infrastructure: [], satellites: [],
  nuclear: [], pipelines: [], cables: [], ports: [], chokepoints: [], volcanoes: [],
  spaceports: [], refineries: [], outages: [], airports: [], notams: [], outbreaks: [],
  energy: [], patents: [], startups: [], gdelt: [],
};

function geoItems(items: Item[]): Item[] {
  return items.filter((i) => typeof i.lat === "number" && typeof i.lon === "number");
}

function staticLayer(earthItems: Item[], category: string): Item[] {
  return geoItems(earthItems.filter((i) => i.tags.includes("static-geo") && i.tags.includes(category)));
}

function outageItems(infraItems: Item[]): Item[] {
  return geoItems(
    infraItems
      .filter((i) => i.connectorId === "statuspage_incidents")
      .map((i) => {
        const key = Object.keys(PLATFORM_HQ).find((k) => i.title.includes(k) || i.source?.includes(k));
        const hq = key ? PLATFORM_HQ[key] : null;
        if (!hq) return i;
        return { ...i, lat: hq.lat, lon: hq.lon };
      }),
  );
}

export interface GlobeLiveMeta {
  flightsUpdatedAt?: string | null;
  flightsStale?: boolean;
  flightsAgeSeconds?: number | null;
  shipsUpdatedAt?: string | null;
  shipsStale?: boolean;
  shipsCount?: number;
  shipsConfigured?: boolean;
  tomtomConfigured?: boolean;
  hydratedMs?: number;
}

interface IntegrationRow {
  id: string;
  label: string;
  configured: boolean;
  state: string;
  liveCount?: number;
  ageSeconds?: number | null;
  updatedAt?: string | null;
  uiPath: string;
}

interface BootstrapPayload {
  flights?: { global?: Item[]; stale?: boolean; ageSeconds?: number | null; updatedAt?: string | null };
  ships?: {
    items?: Item[];
    stale?: boolean;
    cold?: boolean;
    configured?: boolean;
    ageSeconds?: number | null;
    updatedAt?: string | null;
  };
  webcams?: { items?: Array<{ id: string; title: string; place?: string; lat?: number; lon?: number; url: string; provider: string }> };
  cctv?: { cameras?: CctvCamera[]; stale?: boolean; cold?: boolean };
  iss?: { lat: number; lon: number; altitudeKm?: number; velocityKmh?: number; timestamp?: string } | null;
  modules?: Record<string, { items?: Item[]; stale?: boolean }>;
  integrations?: IntegrationRow[];
  features?: { aishub?: boolean; tomtom?: boolean };
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
    url: cameraAgencyUrl(c.source),
    tags: ["cctv", "snapshot", c.source],
    entities: [{ name: c.region, type: "location" }],
    contentPolicy: "metadata_only",
    extra: {
      imageUrl: c.imageUrl,
      refreshSeconds: c.refreshSeconds,
      cctvStatus: c.status,
      legalMode: "image" as const,
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
  const [layerData, setLayerData] = useState<LayerData>(EMPTY_LAYERS);
  const [meta, setMeta] = useState<GlobeLiveMeta>({});
  const [loading, setLoading] = useState(true);

  const applyBootstrap = useCallback((data: BootstrapPayload) => {
    const earthItems = data.modules?.earth?.items ?? [];
    const quakeItems = earthItems.filter((i) => i.tags.includes("earthquake"));
    setQuakes(quakeItems);
    const eventItems = [
      ...earthItems.filter((i) => typeof i.lat === "number" && !i.tags.includes("earthquake") && !i.tags.includes("forecast")),
      ...(data.modules?.news?.items ?? []).filter((i) => typeof i.lat === "number"),
    ];
    setEvents(eventItems);

    const newsItems = data.modules?.news?.items ?? [];
    const conflictItems = data.modules?.conflict?.items ?? [];
    const govItems = data.modules?.government?.items ?? [];
    const cyberItems = data.modules?.cyber?.items ?? [];
    const marketItems = data.modules?.markets?.items ?? [];
    const infraItems = data.modules?.infrastructure?.items ?? [];
    const spaceItems = data.modules?.space?.items ?? [];
    const aviationItems = data.modules?.aviation?.items ?? [];
    const startupItems = data.modules?.startup?.items ?? [];
    const macroItems = data.modules?.macro?.items ?? [];

    setLayerData({
      events: eventItems,
      quakes: quakeItems,
      iss: [],
      flights: data.flights?.global ?? [],
      ships: data.ships?.items ?? [],
      webcams: (data.webcams?.items ?? []).map(webcamToItem).filter((x): x is Item => x != null),
      cctv: (data.cctv?.cameras ?? []).map(cctvToItem),
      fires: geoItems(earthItems.filter((i) => i.tags.includes("fire") || i.connectorId === "nasa-firms")),
      advisories: geoItems(conflictItems.filter((i) => i.tags.includes("advisory"))),
      sanctions: geoItems(govItems.filter((i) => i.connectorId === "sanctions_pressure")),
      conflicts: geoItems(conflictItems.filter((i) => !i.tags.includes("advisory") && !i.tags.includes("outbreak"))),
      cyber: geoItems(cyberItems),
      forecasts: geoItems(earthItems.filter((i) => i.tags.includes("forecast"))),
      predictions: marketItems.filter((i) => i.connectorId === "polymarket_markets"),
      infrastructure: geoItems(infraItems),
      satellites: geoItems(spaceItems.filter((i) => !i.tags.includes("iss"))),
      nuclear: staticLayer(earthItems, "nuclear"),
      pipelines: staticLayer(earthItems, "pipelines"),
      cables: staticLayer(earthItems, "cables"),
      ports: staticLayer(earthItems, "ports"),
      chokepoints: staticLayer(earthItems, "chokepoints"),
      volcanoes: staticLayer(earthItems, "volcanoes"),
      spaceports: staticLayer(earthItems, "spaceports"),
      refineries: staticLayer(earthItems, "refineries"),
      outages: outageItems(infraItems),
      airports: geoItems(aviationItems.filter((i) => i.connectorId === "major_airport_hubs")),
      notams: geoItems(aviationItems.filter((i) => i.tags.includes("notam"))),
      outbreaks: conflictItems.filter((i) => i.tags.includes("outbreak") || i.connectorId === "who_disease_outbreaks"),
      energy: macroItems.filter((i) => i.tags.some((t) => t.includes("energy") || t.includes("eia"))),
      patents: govItems.filter((i) => i.connectorId === "patentsview_recent"),
      startups: startupItems,
      gdelt: newsItems.filter((i) => i.connectorId === "gdelt_events" || i.tags.includes("gdelt")),
    });

    setFlights(data.flights?.global ?? []);
    setShips(data.ships?.items ?? []);
    setWebcams(
      (data.webcams?.items ?? [])
        .map(webcamToItem)
        .filter((x): x is Item => x != null),
    );
    setCctv((data.cctv?.cameras ?? []).map(cctvToItem));

    if (data.iss && typeof data.iss.lat === "number") {
      const issItem: Item = {
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
      };
      setIss([issItem]);
      setLayerData((prev) => ({ ...prev, iss: [issItem] }));
    }

    setMeta({
      flightsUpdatedAt: data.flights?.updatedAt ?? null,
      flightsStale: Boolean(data.flights?.stale),
      flightsAgeSeconds: data.flights?.ageSeconds ?? null,
      shipsUpdatedAt: data.ships?.updatedAt ?? null,
      shipsStale: Boolean(data.ships?.stale),
      shipsCount: data.ships?.items?.length ?? 0,
      shipsConfigured: data.ships?.configured ?? data.features?.aishub ?? false,
      tomtomConfigured: data.features?.tomtom
        ?? data.integrations?.some((i) => i.id === "tomtom" && i.configured)
        ?? false,
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

  useSmartPoll(load, { intervalMs: 90_000, hiddenBackoff: 2, maxHiddenIntervalMs: 300_000 });

  return {
    quakes, events, flights, ships, webcams, cctv, iss, layerData, meta, loading, refresh: load,
  };
}
