"use client";

// GlobeDashboard — the hero view: an auto-rotating globe that plots live
// events, quakes, flights and the ISS, with a HUD legend (top-right, toggles
// layers), a module rail (bottom-left), a floating detail window on click, a
// live UTC clock, a coordinate/zoom readout, and a bottom ticker. Theme-aware
// via the design-system tokens.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapView, type MapLayer } from "@/components/MapView";
import { Badge } from "@/components/Badge";
import { MODULES } from "@/lib/modules";
import type { Item } from "@/lib/types";

const LEGEND_COLORS: Record<string, string> = {
  events: "var(--color-info)",
  quakes: "var(--color-warning)",
  iss: "var(--color-accent-2)",
  flights: "var(--color-live)",
};

type LayerKey = keyof typeof LEGEND_COLORS;

export function GlobeDashboard({
  quakes = [], flights = [], events = [], iss = [],
}: {
  quakes?: Item[];
  flights?: Item[];
  events?: Item[];
  iss?: Item[];
}) {
  const [now, setNow] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Item | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number; zoom: number } | null>(null);
  const [toggles, setToggles] = useState<Record<LayerKey, boolean>>({
    events: true, quakes: true, iss: true, flights: true,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const layers = useMemo((): MapLayer[] => {
    const out: MapLayer[] = [];
    if (toggles.events) out.push({ id: "events", color: LEGEND_COLORS.events, items: events, radius: 4 });
    if (toggles.quakes) out.push({ id: "quakes", color: LEGEND_COLORS.quakes, items: quakes, radius: 3 });
    if (toggles.iss) out.push({ id: "iss", color: LEGEND_COLORS.iss, items: iss, radius: 6 });
    if (toggles.flights) out.push({ id: "flights", color: LEGEND_COLORS.flights, items: flights, radius: 2, icon: "plane" });
    return out;
  }, [toggles, events, quakes, iss, flights]);

  const allItems = useMemo(() => [...events, ...quakes, ...iss, ...flights], [events, quakes, iss, flights]);
  const ticker = useMemo(() => allItems.map((i) => i.title).filter(Boolean).slice(0, 24), [allItems]);

  return (
    <div className="globe-backdrop relative h-[64vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-line">
      <MapView
        layers={layers}
        onSelect={(id) => setSelected(allItems.find((i) => i.id === id) ?? null)}
        onMove={setCoords}
        defaultGlobe
        autoRotate
        zoom={1.5}
        className="h-full w-full"
      />

      {/* UTC clock, top-right */}
      <div className="pointer-events-none absolute right-4 top-3 z-10 flex items-center gap-2">
        <Badge tone="live" pulse>Live</Badge>
        <span className="mono text-[11px] text-ink-dim">{now.toISOString().replace("T", " ").slice(0, 19)} UTC</span>
      </div>

      {/* Legend / layer toggles, top-right */}
      <div className="hud-window absolute right-4 top-12 z-10 flex flex-col gap-1.5 rounded-lg px-3 py-2.5">
        <span className="mb-0.5 text-[9px] font-medium uppercase tracking-widest text-ink-dim">Layers</span>
        {(Object.keys(LEGEND_COLORS) as LayerKey[]).map((key) => {
          const count =
            key === "events" ? events.length : key === "quakes" ? quakes.length : key === "iss" ? iss.length : flights.length;
          return (
            <button
              key={key}
              onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
              className="flex items-center gap-2 text-left text-[11px] uppercase tracking-wide"
            >
              <span
                className="h-2 w-2 rounded-full border"
                style={{ borderColor: LEGEND_COLORS[key], background: toggles[key] ? LEGEND_COLORS[key] : "transparent" }}
              />
              <span className={toggles[key] ? "text-ink" : "text-ink-dim"}>{key}</span>
              <span className="mono ml-auto text-[10px] text-ink-dim">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Module rail, bottom-left */}
      <div className="hud-window absolute bottom-11 left-4 z-10 hidden flex-col gap-0.5 rounded-lg p-1.5 sm:flex">
        {MODULES.slice(0, 9).map((m) => (
          <Link
            key={m.id}
            href={m.path}
            className="rounded-md px-2.5 py-1.5 text-[12px] text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
          >
            {m.name}
          </Link>
        ))}
      </div>

      {/* Coordinate / zoom readout, bottom-center */}
      {coords && (
        <div className="pointer-events-none absolute bottom-11 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-panel-hud px-3 py-1 backdrop-blur">
          <span className="mono text-[11px] text-ink-dim">
            {coords.lat.toFixed(2)}° {coords.lat >= 0 ? "N" : "S"}, {Math.abs(coords.lon).toFixed(2)}° {coords.lon >= 0 ? "E" : "W"} · zoom {coords.zoom.toFixed(1)}×
          </span>
        </div>
      )}

      {/* Selected item HUD window */}
      {selected && (
        <div className="hud-window absolute right-4 top-48 z-20 w-[360px] max-w-[calc(100%-2rem)] rounded-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="hud-pulse h-2 w-2 rounded-full bg-live" />
              <span className="mono text-[11px] uppercase tracking-wide text-ink-dim">{selected.tags[0] ?? "signal"}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-ink-dim hover:text-ink" aria-label="Close">✕</button>
          </div>
          <div className="p-3">
            <div className="text-[13px] font-medium text-ink">{selected.title}</div>
            {selected.summary && <p className="mt-1 line-clamp-4 text-[12px] leading-relaxed text-soft">{selected.summary}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="info">{selected.source}</Badge>
              {selected.url && (
                <a href={selected.url} target="_blank" rel="noreferrer" className="text-[11px] text-accent underline">
                  Open source →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom live ticker */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-8 items-center gap-3 overflow-hidden border-t border-line bg-body/85 px-3">
        <Badge tone="live" pulse>Feed</Badge>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track whitespace-nowrap text-[11px] text-soft">
            {ticker.length === 0
              ? <span>Connecting to live feeds…</span>
              : [...ticker, ...ticker].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
