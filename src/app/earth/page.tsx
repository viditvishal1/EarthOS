"use client";

// Earth View — mission-control HUD. A full-bleed globe with floating panels:
// a live layers panel (right), a global activity feed (left), and a
// coordinate/zoom readout (bottom). Clicking a marker opens the in-app detail
// panel — no external redirects. Theme-aware via the design-system tokens.

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { MapView, type MapLayer } from "@/components/MapView";
import { ReaderPane } from "@/components/ReaderPane";
import { Badge } from "@/components/Badge";
import { timeAgo } from "@/components/ModuleView";

const LAYER_DEFS = [
  { id: "earthquakes", label: "Earthquakes", color: "#fb923c", tags: ["earthquake"] },
  { id: "wildfires", label: "Wildfires", color: "#f87171", tags: ["wildfire"] },
  { id: "storms", label: "Storms & floods", color: "#38bdf8", tags: ["storm", "flood"] },
  { id: "volcanoes", label: "Natural events", color: "#e879f9", tags: ["volcano", "ice", "drought", "natural-event"] },
  { id: "flights", label: "Flights (Europe)", color: "#39ff8f", tags: ["flight"] },
  { id: "iss", label: "ISS", color: "#4cc2ff", tags: ["iss"] },
];

export default function EarthPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [flights, setFlights] = useState<Item[]>([]);
  const [iss, setIss] = useState<Item | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(["earthquakes", "wildfires", "storms", "volcanoes", "iss"]));
  const [selected, setSelected] = useState<Item | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [minMag, setMinMag] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number; zoom: number } | null>(null);

  useEffect(() => {
    fetch("/api/modules/earth").then((r) => r.json()).then((d) => {
      if (d.items) { setItems(d.items); setFetchedAt(d.fetchedAt); }
    });
  }, []);

  useEffect(() => {
    if (!enabled.has("flights")) return;
    const load = () => fetch("/api/flights?region=europe").then((r) => r.json()).then((d) => setFlights(d.items ?? []));
    load();
    const t = setInterval(load, 90_000);
    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!enabled.has("iss")) return;
    const load = () =>
      fetch("/api/iss").then((r) => r.json()).then((d) => {
        if (typeof d.lat !== "number") return;
        setIss({
          id: "iss",
          module: "space",
          connectorId: "iss",
          title: "International Space Station",
          summary: d.altitudeKm != null
            ? `Altitude ${d.altitudeKm.toFixed(0)} km · velocity ${d.velocityKmh?.toFixed(0)} km/h`
            : `Position ${d.lat.toFixed(2)}°, ${d.lon.toFixed(2)}°`,
          source: "wheretheiss.at",
          timestamp: d.timestamp,
          lat: d.lat, lon: d.lon,
          tags: ["iss"],
          entities: [{ name: "ISS", type: "satellite" }],
          contentPolicy: "full_cache",
        });
      });
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [enabled]);

  const layers = useMemo((): MapLayer[] => {
    const out: MapLayer[] = [];
    for (const def of LAYER_DEFS) {
      if (!enabled.has(def.id)) continue;
      let layerItems: Item[];
      if (def.id === "flights") layerItems = flights;
      else if (def.id === "iss") layerItems = iss ? [iss] : [];
      else layerItems = items.filter((i) => def.tags.some((t) => i.tags.includes(t)));
      if (def.id === "earthquakes" && minMag > 0) {
        layerItems = layerItems.filter((i) => (i.severity ?? 0) >= minMag);
      }
      out.push({
        id: def.id,
        color: def.color,
        items: layerItems,
        radius: def.id === "iss" ? 8 : 4,
        icon: def.id === "flights" ? ("plane" as const) : undefined,
      });
    }
    return out;
  }, [items, flights, iss, enabled, minMag]);

  const allSelectable = useMemo(() => [...items, ...flights, ...(iss ? [iss] : [])], [items, flights, iss]);

  const feed = useMemo(
    () => [...items].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || b.timestamp.localeCompare(a.timestamp)).slice(0, 12),
    [items],
  );

  const countFor = (def: (typeof LAYER_DEFS)[number]): number => {
    if (def.id === "flights") return flights.length;
    if (def.id === "iss") return iss ? 1 : 0;
    return items.filter((i) => def.tags.some((t) => i.tags.includes(t))).length;
  };

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id); else next.add(id);
    setEnabled(next);
  };

  return (
    <div className="globe-backdrop relative h-[calc(100vh-6.5rem)] w-full overflow-hidden rounded-xl border border-line">
      <MapView
        layers={layers}
        defaultBasemap="satellite"
        defaultGlobe
        autoRotate
        rotateSpeed={0.03}
        zoom={2.2}
        onMove={setCoords}
        onSelect={(id) => setSelected(allSelectable.find((i) => i.id === id) ?? null)}
        className="h-full w-full"
      />

      {/* Title + freshness, top-left */}
      <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-2">
        <h1 className="text-sm font-semibold text-ink">Earth View</h1>
        <Badge tone="live" pulse>Live</Badge>
        {fetchedAt && <span className="mono text-[11px] text-ink-dim">events {timeAgo(fetchedAt)}</span>}
      </div>

      {/* Global activity feed, left */}
      <div className="hud-window absolute bottom-14 left-4 top-12 z-10 flex w-72 max-w-[calc(100%-2rem)] flex-col rounded-lg">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-ink-dim">Global activity</span>
          <Badge tone="live" pulse>Live</Badge>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {feed.length === 0 && <div className="px-2 py-4 text-[11px] text-ink-dim">Warming up connectors…</div>}
          {feed.map((it) => {
            const sev = it.severity ?? 0;
            const tone = sev >= 6 ? "critical" : sev >= 4 ? "warning" : "info";
            return (
              <button
                key={it.id}
                onClick={() => setSelected(it)}
                className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === "critical" ? "bg-critical" : tone === "warning" ? "bg-warning" : "bg-info"}`} />
                  <span className="truncate text-[12px] text-ink">{it.title}</span>
                </div>
                <div className="mt-0.5 pl-3 text-[10px] text-ink-dim">{it.source} · {timeAgo(it.timestamp)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layers panel, right */}
      <div className="hud-window absolute right-4 top-12 z-10 flex w-56 flex-col gap-1 rounded-lg p-2.5">
        <span className="mb-1 text-[10px] font-medium uppercase tracking-widest text-ink-dim">Layers</span>
        {LAYER_DEFS.map((def) => {
          const on = enabled.has(def.id);
          return (
            <button
              key={def.id}
              onClick={() => toggle(def.id)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-panel-2"
              aria-pressed={on}
            >
              <span className="h-2 w-2 rounded-full border" style={{ borderColor: def.color, background: on ? def.color : "transparent" }} />
              <span className={`text-[12px] ${on ? "text-ink" : "text-ink-dim"}`}>{def.label}</span>
              <span className="mono ml-auto text-[10px] text-ink-dim">{countFor(def)}</span>
            </button>
          );
        })}
        <label className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-ink-dim">
          Min mag
          <input type="range" min={0} max={7} step={0.5} value={minMag}
            onChange={(e) => setMinMag(parseFloat(e.target.value))} className="w-16 accent-[#fb923c]" />
          <span className="mono text-ink">{minMag || "all"}</span>
        </label>
      </div>

      {/* Coordinate / zoom readout, bottom-center */}
      {coords && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-panel-hud px-3 py-1 backdrop-blur">
          <span className="mono text-[11px] text-ink-dim">
            {coords.lat.toFixed(2)}° {coords.lat >= 0 ? "N" : "S"}, {Math.abs(coords.lon).toFixed(2)}° {coords.lon >= 0 ? "E" : "W"} · zoom {coords.zoom.toFixed(1)}×
          </span>
        </div>
      )}

      {/* Selected item reader, right overlay */}
      {selected && (
        <div className="absolute right-4 top-12 z-20 max-h-[85%] w-96 max-w-[calc(100%-2rem)] overflow-hidden">
          <ReaderPane item={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
