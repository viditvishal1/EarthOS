"use client";

// Globe explorer — self-fetching live layers, quick-module rail (Dashboard tab),
// layer toggles with counts, auto-rotate, and bottom ticker. Does NOT render
// the full nav module list (that was the stuck-dropdown bug).

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Zap, CandlestickChart, Tv, Target, Video, AlertTriangle, Biohazard,
  Radio, Globe2, Map as MapIcon,
} from "lucide-react";
import { MapView, type MapLayer } from "@/components/MapView";
import { Badge } from "@/components/Badge";
import { EntityDetailPanel } from "@/components/EntityDetailPanel";
import { IntegrationBadge, integrationDetail } from "@/components/IntegrationBadge";
import { QuickPanel, type QuickKind } from "@/components/quick/QuickPanels";
import { useGlobeLiveData } from "@/lib/hooks/useGlobeLiveData";
import { useViewportFlights } from "@/lib/hooks/useViewportFlights";
import type { MapBounds } from "@/lib/maps/bbox";
import { useEntityTrack } from "@/lib/hooks/useEntityTrack";
import type { Item } from "@/lib/types";

const LAYER_META = {
  events: { label: "Events", color: "var(--color-info)", key: "events" as const },
  quakes: { label: "Quakes", color: "var(--color-warning)", key: "quakes" as const },
  iss: { label: "ISS", color: "var(--color-accent-2)", key: "iss" as const },
  flights: { label: "Flights", color: "var(--color-live)", key: "flights" as const },
  ships: { label: "Ships", color: "#22d3ee", key: "ships" as const },
  webcams: { label: "Webcams", color: "#a78bfa", key: "webcams" as const },
  cctv: { label: "CCTV", color: "#f472b6", key: "cctv" as const },
} as const;

type LayerKey = keyof typeof LAYER_META;

const QUICK_RAIL: { kind: QuickKind; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { kind: "wire", label: "Wire", Icon: Zap },
  { kind: "stocks", label: "Stocks", Icon: CandlestickChart },
  { kind: "streams", label: "Streams", Icon: Tv },
  { kind: "predictions", label: "Predictions", Icon: Target },
  { kind: "cameras", label: "Cameras", Icon: Video },
  { kind: "defcon", label: "Defcon", Icon: AlertTriangle },
  { kind: "outbreaks", label: "Outbreaks", Icon: Biohazard },
];

type ViewMode = "globe" | "map" | "wire";

export function GlobeDashboard({
  variant = "embedded",
  fullBleed = false,
  region = "global",
  quakes: quakesProp,
  flights: flightsProp,
  events: eventsProp,
  iss: issProp,
}: {
  variant?: "embedded" | "dashboard";
  fullBleed?: boolean;
  region?: string;
  /** Optional overrides — when omitted, data is self-fetched. */
  quakes?: Item[];
  flights?: Item[];
  events?: Item[];
  iss?: Item[];
}) {
  const live = useGlobeLiveData(region);
  const quakes = quakesProp ?? live.quakes;
  const events = eventsProp ?? live.events;
  const iss = issProp ?? live.iss;
  const ships = live.ships;
  const webcams = live.webcams;
  const cctv = live.cctv;

  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<Item | null>(null);
  const [coords, setCoords] = useState<MapBounds | null>(null);
  const [toggles, setToggles] = useState<Record<LayerKey, boolean>>({
    events: true, quakes: true, iss: true, flights: true, ships: false, webcams: false, cctv: false,
  });
  const [isolate, setIsolate] = useState<LayerKey | null>(null);
  const [autoRotate, setAutoRotate] = useState(variant === "dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("globe");
  const [quickOpen, setQuickOpen] = useState<QuickKind | null>(null);

  const flightsBase = flightsProp ?? live.flights;
  const viewportFlights = useViewportFlights(toggles.flights && flightsProp == null, coords);
  const flights = viewportFlights.active && viewportFlights.flights.length > 0
    ? viewportFlights.flights
    : flightsBase;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const counts: Record<LayerKey, number> = {
    events: events.length,
    quakes: quakes.length,
    iss: iss.length,
    flights: flights.length,
    ships: ships.length,
    webcams: webcams.length,
    cctv: cctv.length,
  };

  const activeToggles = useMemo(() => {
    if (!isolate) return toggles;
    return Object.fromEntries(
      (Object.keys(toggles) as LayerKey[]).map((k) => [k, k === isolate]),
    ) as Record<LayerKey, boolean>;
  }, [toggles, isolate]);

  const layers = useMemo((): MapLayer[] => {
    const out: MapLayer[] = [];
    if (activeToggles.events) out.push({ id: "events", color: LAYER_META.events.color, items: events, radius: 4 });
    if (activeToggles.quakes) out.push({ id: "quakes", color: LAYER_META.quakes.color, items: quakes, radius: 3 });
    if (activeToggles.iss) out.push({ id: "iss", color: LAYER_META.iss.color, items: iss, radius: 6 });
    if (activeToggles.flights) out.push({ id: "flights", color: LAYER_META.flights.color, items: flights, radius: 2, icon: "plane" });
    if (activeToggles.ships) out.push({ id: "ships", color: LAYER_META.ships.color, items: ships, radius: 3 });
    if (activeToggles.webcams) out.push({ id: "webcams", color: LAYER_META.webcams.color, items: webcams, radius: 4 });
    if (activeToggles.cctv) out.push({ id: "cctv", color: LAYER_META.cctv.color, items: cctv, radius: 4 });
    return out;
  }, [activeToggles, events, quakes, iss, flights, ships, webcams, cctv]);

  const allItems = useMemo(
    () => [...events, ...quakes, ...iss, ...flights, ...ships, ...webcams, ...cctv],
    [events, quakes, iss, flights, ships, webcams, cctv],
  );

  const trackLines = useEntityTrack(selected);

  const ticker = useMemo(
    () => allItems.map((i) => i.title).filter(Boolean).slice(0, 32),
    [allItems],
  );

  const shellClass = fullBleed
    ? "relative h-full min-h-[420px] w-full overflow-hidden bg-black"
    : "globe-backdrop relative h-[64vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-line";

  const freshness = live.meta.flightsAgeSeconds != null
    ? `${Math.round(live.meta.flightsAgeSeconds)}s ago${live.meta.flightsStale ? " · stale" : ""}`
    : live.loading ? "loading…" : "—";

  return (
    <div className={shellClass}>
      {viewMode !== "wire" && (
        <MapView
          layers={layers}
          lines={trackLines}
          highlightId={selected?.id}
          onSelect={(id) => setSelected(allItems.find((i) => i.id === id) ?? null)}
          onMove={setCoords}
          defaultBasemap={variant === "dashboard" ? "satellite" : "dark"}
          defaultGlobe={viewMode === "globe"}
          autoRotate={autoRotate && viewMode === "globe"}
          rotateSpeed={0.04}
          zoom={variant === "dashboard" ? 1.4 : 1.5}
          mapControlsClass={variant === "dashboard" ? "left-3 top-[3.75rem]" : undefined}
          className="h-full w-full [&>div:first-child]:rounded-none [&>div:first-child]:border-0"
        />
      )}

      {viewMode === "wire" && (
        <div className="flex h-full flex-col bg-body p-4">
          <p className="mb-3 text-xs text-ink-dim">Wire view — live headline stream (globe hidden)</p>
          <div className="flex-1 overflow-y-auto rounded-lg border border-line bg-panel p-3">
            {ticker.length === 0 ? (
              <p className="text-xs text-ink-dim">Connecting to live feeds…</p>
            ) : (
              ticker.map((t, i) => (
                <div key={i} className="border-b border-line/50 py-2 text-sm text-ink last:border-0">{t}</div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Top bar: view mode + clock */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-body/90 p-0.5 backdrop-blur">
          {([
            { id: "globe" as const, label: "Globe", Icon: Globe2 },
            { id: "map" as const, label: "Map", Icon: MapIcon },
            { id: "wire" as const, label: "Wire", Icon: Radio },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                viewMode === id ? "bg-panel-2 text-accent" : "text-ink-dim hover:text-ink"
              }`}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Badge tone="live" pulse>Live</Badge>
            <span className="mono text-[10px] text-ink-dim">{now.toISOString().replace("T", " ").slice(0, 19)} UTC</span>
          </div>
          {variant === "dashboard" && (
            <div className="flex flex-col items-end gap-1">
              <span className="mono text-[9px] text-ink-dim">flights {freshness}</span>
              <div className="flex flex-wrap justify-end gap-1">
                {live.meta.shipsConfigured && (
                  <IntegrationBadge
                    label="AIS"
                    state={
                      (live.meta.shipsCount ?? 0) > 0
                        ? live.meta.shipsStale ? "stale" : "fresh"
                        : "awaiting-seed"
                    }
                    count={live.meta.shipsCount}
                    href="/maritime"
                    detail={integrationDetail(
                      (live.meta.shipsCount ?? 0) > 0
                        ? live.meta.shipsStale ? "stale" : "fresh"
                        : "awaiting-seed",
                      true,
                      live.meta.shipsCount,
                      live.meta.flightsAgeSeconds,
                    )}
                  />
                )}
                {live.meta.tomtomConfigured && (
                  <IntegrationBadge
                    label="Traffic"
                    state="ready"
                    href="/city"
                    detail="TomTom configured — City Twin traffic layer"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layers panel — top right (below view-mode bar) */}
      <div className="hud-window absolute right-3 top-[3.75rem] z-10 flex w-44 max-h-[min(420px,calc(100%-6rem))] flex-col gap-1 overflow-y-auto rounded-lg px-2.5 py-2">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[9px] font-medium uppercase tracking-widest text-ink-dim">Layers</span>
          {isolate && (
            <button type="button" onClick={() => setIsolate(null)} className="text-[9px] text-accent hover:underline">
              show all
            </button>
          )}
        </div>
        {(Object.keys(LAYER_META) as LayerKey[]).map((key) => {
          const meta = LAYER_META[key];
          const on = activeToggles[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Isolate ${meta.label}`}
                onClick={() => setIsolate(isolate === key ? null : key)}
                className="h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-transform hover:scale-125"
                style={{
                  borderColor: meta.color,
                  background: on ? meta.color : "transparent",
                  boxShadow: isolate === key ? `0 0 6px ${meta.color}` : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
                className="flex flex-1 items-center gap-1 text-left text-[10px] uppercase tracking-wide"
              >
                <span className={on ? "text-ink" : "text-ink-dim"}>{meta.label}</span>
                <span className="mono ml-auto text-[9px] text-ink-dim">
                  {counts[key]}
                  {key === "ships" && live.meta.shipsConfigured && counts.ships === 0 && (
                    <span className="text-amber-400/90" title="AIS key configured — awaiting seed"> · …</span>
                  )}
                </span>
              </button>
            </div>
          );
        })}
        <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-line pt-1.5 text-[10px] uppercase tracking-wide text-ink-dim">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
            className="accent-[var(--color-live)]"
          />
          Auto rotate
        </label>
      </div>

      {/* Quick-module rail — dashboard only (above bottom ticker) */}
      {variant === "dashboard" && (
        <div className="hud-window absolute bottom-12 left-3 z-10 flex max-h-[min(420px,calc(100%-9rem))] flex-col gap-0.5 overflow-y-auto rounded-lg p-1">
          {QUICK_RAIL.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => setQuickOpen(quickOpen === kind ? null : kind)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                quickOpen === kind ? "bg-panel-2 text-accent" : "text-ink-dim hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}

      {quickOpen && variant === "dashboard" && (
        <QuickPanel kind={quickOpen} onClose={() => setQuickOpen(null)} />
      )}

      {coords && viewMode !== "wire" && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-10 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border border-line bg-panel-hud px-3 py-1 backdrop-blur">
          <span className="mono text-[10px] text-ink-dim">
            {coords.lat.toFixed(2)}° {coords.lat >= 0 ? "N" : "S"}, {Math.abs(coords.lon).toFixed(2)}° {coords.lon >= 0 ? "E" : "W"} · zoom {coords.zoom.toFixed(1)}×
          </span>
        </div>
      )}

      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center px-3 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-52 sm:w-[min(380px,calc(100%-1.5rem))] sm:justify-end">
          <div className="pointer-events-auto w-full max-w-md sm:max-w-none">
            <EntityDetailPanel item={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}

      {/* Bottom ticker */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex h-9 items-center gap-2 overflow-hidden border-t border-line bg-body/90 px-3 backdrop-blur">
        <Badge tone="live" pulse>Feed</Badge>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex gap-8 whitespace-nowrap text-[11px] text-soft">
            {ticker.length === 0 ? (
              <span>Connecting to live feeds…</span>
            ) : (
              [...ticker, ...ticker].map((t, i) => (
                <span key={i} className="inline-flex shrink-0 items-center gap-2">
                  <span className="text-ink-dim">·</span> {t}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
