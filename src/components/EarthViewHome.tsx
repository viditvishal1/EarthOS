"use client";

// Earth View — intelligence OS home: KPI strip, full-bleed map, layer toggles,
// activity/signals/alerts below map, five-panel grid, bottom ticker.

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Shield, CandlestickChart, Ship, Plane, Car, Leaf, CloudSun,
  Activity, TrendingUp, AlertTriangle, Network, FolderOpen, Building2,
} from "lucide-react";
import type { Item } from "@/lib/types";
import { MapView, type MapLayer } from "@/components/MapView";
import { Badge } from "@/components/Badge";
import { EntityDetailPanel } from "@/components/EntityDetailPanel";
import { LiveNumber } from "@/components/LiveNumber";
import { Skeleton } from "@/components/Skeleton";
import { timeAgo } from "@/components/ModuleView";
import { useGlobeLiveData } from "@/lib/hooks/useGlobeLiveData";
import { useEntityTrack } from "@/lib/hooks/useEntityTrack";

const LAYER_META = {
  events: { label: "Events", color: "#38bdf8" },
  quakes: { label: "Quakes", color: "#fb923c" },
  iss: { label: "ISS", color: "#4ade80" },
  flights: { label: "Flights", color: "#39ff8f" },
  ships: { label: "Ships", color: "#22d3ee" },
  webcams: { label: "Webcams", color: "#a78bfa" },
  cctv: { label: "CCTV", color: "#f472b6" },
} as const;

type LayerKey = keyof typeof LAYER_META;

interface KpiState {
  alerts: number;
  criticalAlerts: number;
  spChange?: string;
  vessels: number;
  aircraft: number;
  traffic?: string;
  aqi?: number;
  weather?: { temp: number; condition: string; humidity?: number; wind?: number };
}

function KpiCard({
  icon: Icon, label, value, sub, href, accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: string;
  href: string;
  accent?: string;
}) {
  return (
    <Link href={href} className="min-w-0 rounded-lg border border-line bg-panel p-3 transition-colors hover:bg-panel-2">
      <div className="flex items-center gap-1.5 truncate text-[10px] uppercase tracking-wide text-ink-dim">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </div>
      <div className={`mono mt-1 truncate text-xl font-semibold ${accent ?? "text-ink"}`}>
        {typeof value === "number" ? <LiveNumber value={value} /> : value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-ink-dim">{sub}</div>}
    </Link>
  );
}

export function EarthViewHome() {
  const live = useGlobeLiveData("global");
  const [items, setItems] = useState<Item[]>([]);
  const [markets, setMarkets] = useState<Item[]>([]);
  const [investigations, setInvestigations] = useState<{ id: string; title: string; status: string; updated_at: string }[]>([]);
  const [alerts, setAlerts] = useState<{ title: string; severity: string; created_at?: string }[]>([]);
  const [kpi, setKpi] = useState<KpiState>({ alerts: 0, criticalAlerts: 0, vessels: 0, aircraft: 0 });
  const [cityWeather, setCityWeather] = useState<KpiState["weather"]>();
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [toggles, setToggles] = useState<Record<LayerKey, boolean>>({
    events: true, quakes: true, iss: true, flights: true, ships: true, webcams: false, cctv: false,
  });
  const [isolate, setIsolate] = useState<LayerKey | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((data) => {
        const all: Item[] = [];
        for (const mod of ["earth", "news", "conflict", "cyber"] as const) {
          all.push(...(data.modules?.[mod]?.items ?? []));
        }
        setItems(all);
        setMarkets(data.modules?.markets?.items ?? []);
        setFetchedAt(data.fetchedAt);

        const m = (data.modules?.markets?.items ?? []) as Item[];
        const sp = m.find((i) => i.title.includes("S&P") || i.tags.includes("^gspc"));
        const raw = sp?.extra?.change24h ?? sp?.severityLabel;
        if (raw != null && raw !== "") {
          const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
          if (Number.isFinite(n)) {
            setKpi((k) => ({ ...k, spChange: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` }));
          } else {
            const s = String(raw).trim();
            if (s && !s.includes("NaN")) {
              setKpi((k) => ({ ...k, spChange: s.includes("%") ? s : `${s}%` }));
            }
          }
        }
      })
      .catch(() => {});

    Promise.allSettled([
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/investigations").then((r) => r.json()),
      fetch("/api/weather?lat=1.35&lon=103.82").then((r) => r.json()),
      fetch("/api/traffic?minLat=1.2&minLon=103.6&maxLat=1.5&maxLon=104.0").then((r) => r.json()),
    ]).then((results) => {
      if (results[0].status === "fulfilled") {
        const a = results[0].value.alerts ?? [];
        setAlerts(a);
        setKpi((k) => ({
          ...k,
          alerts: a.length,
          criticalAlerts: a.filter((x: { severity: string }) => x.severity === "critical").length,
        }));
      }
      if (results[1].status === "fulfilled") {
        setInvestigations(results[1].value.investigations ?? []);
      }
      if (results[2].status === "fulfilled" && typeof results[2].value.temperatureC === "number") {
        const w = results[2].value;
        setCityWeather({
          temp: w.temperatureC,
          condition: w.precipitationMm > 0 ? "Rain" : "Clear",
          humidity: w.humidity,
          wind: w.windKmh,
        });
        setKpi((k) => ({ ...k, aqi: w.aqiUs, weather: { temp: w.temperatureC, condition: "Cloudy", humidity: w.humidity, wind: w.windKmh } }));
      }
      if (results[3].status === "fulfilled" && results[3].value.enabled) {
        const segs = results[3].value.segments ?? [];
        const avg = segs.length
          ? segs.reduce((s: number, x: { currentSpeed: number; freeFlowSpeed: number }) =>
            s + (x.freeFlowSpeed > 0 ? x.currentSpeed / x.freeFlowSpeed : 1), 0) / segs.length
          : 1;
        setKpi((k) => ({ ...k, traffic: avg > 0.75 ? "Moderate" : avg > 0.5 ? "Heavy" : "Light" }));
      }
    });
  }, []);

  useEffect(() => {
    setKpi((k) => ({
      ...k,
      aircraft: live.flights.length,
      vessels: live.ships.length,
    }));
  }, [live.flights.length, live.ships.length]);

  const counts: Record<LayerKey, number> = {
    events: live.events.length,
    quakes: live.quakes.length,
    iss: live.iss.length,
    flights: live.flights.length,
    ships: live.ships.length,
    webcams: live.webcams.length,
    cctv: live.cctv.length,
  };

  const activeToggles = useMemo(() => {
    if (!isolate) return toggles;
    return Object.fromEntries(
      (Object.keys(toggles) as LayerKey[]).map((k) => [k, k === isolate]),
    ) as Record<LayerKey, boolean>;
  }, [toggles, isolate]);

  const mapLayers = useMemo((): MapLayer[] => {
    const out: MapLayer[] = [];
    if (activeToggles.events) out.push({ id: "events", color: LAYER_META.events.color, items: live.events.slice(0, 300), radius: 4 });
    if (activeToggles.quakes) out.push({ id: "quakes", color: LAYER_META.quakes.color, items: live.quakes.slice(0, 150), radius: 3 });
    if (activeToggles.iss) out.push({ id: "iss", color: LAYER_META.iss.color, items: live.iss, radius: 6 });
    if (activeToggles.flights) out.push({ id: "flights", color: LAYER_META.flights.color, items: live.flights.slice(0, 2000), radius: 2, icon: "plane" });
    if (activeToggles.ships) out.push({ id: "ships", color: LAYER_META.ships.color, items: live.ships.slice(0, 500), radius: 3 });
    if (activeToggles.webcams) out.push({ id: "webcams", color: LAYER_META.webcams.color, items: live.webcams, radius: 4 });
    if (activeToggles.cctv) out.push({ id: "cctv", color: LAYER_META.cctv.color, items: live.cctv, radius: 4 });
    return out;
  }, [activeToggles, live]);

  const allMapItems = useMemo(
    () => [
      ...live.events.slice(0, 300),
      ...live.quakes.slice(0, 150),
      ...live.iss,
      ...live.flights.slice(0, 2000),
      ...live.ships.slice(0, 500),
      ...live.webcams,
      ...live.cctv,
    ],
    [live],
  );

  const trackLines = useEntityTrack(selected);

  const activity = useMemo(
    () => [...items, ...live.flights.slice(0, 8), ...live.ships.slice(0, 5)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 16),
    [items, live.flights, live.ships],
  );

  const signals = useMemo(
    () => [...items].filter((i) => (i.severity ?? 0) >= 5).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 8),
    [items],
  );

  const tickerItems = useMemo(() => activity.map((i) => i.title).slice(0, 24), [activity]);

  const freshness = live.meta.flightsAgeSeconds != null
    ? `${Math.round(live.meta.flightsAgeSeconds)}s ago${live.meta.flightsStale ? " · stale" : ""}`
    : live.loading ? "loading…" : "—";

  return (
    <div className="-mx-4 space-y-4 pb-14 md:-mx-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-ink">Earth View</h1>
          <p className="text-[11px] text-ink-dim">GLOBAL INTELLIGENCE OS</p>
        </div>
        <Badge tone="live" pulse>● LIVE — All Systems Operational</Badge>
        <span className="mono text-[10px] text-ink-dim">
          flights {freshness}
          {live.meta.hydratedMs != null && ` · ${live.meta.hydratedMs}ms hydrate`}
        </span>
        {fetchedAt && <span className="mono text-[10px] text-ink-dim">feeds {timeAgo(fetchedAt)}</span>}
        <Link href="/dashboard" className="ml-auto text-[11px] text-accent hover:underline">
          Open globe dashboard →
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4 md:px-6 2xl:grid-cols-7">
        <KpiCard icon={Shield} label="Live alerts" value={kpi.alerts} sub={`${kpi.criticalAlerts} critical`} href="/settings" accent={kpi.criticalAlerts > 0 ? "text-critical" : undefined} />
        <KpiCard icon={CandlestickChart} label="Markets" value={kpi.spChange ?? "—"} sub="S&P 500" href="/markets" accent={kpi.spChange?.startsWith("+") ? "text-live" : kpi.spChange?.startsWith("-") ? "text-critical" : undefined} />
        <KpiCard icon={Ship} label="Vessels" value={kpi.vessels.toLocaleString()} sub={`${live.meta.shipsStale ? "stale" : "live"} AIS`} href="/maritime" />
        <KpiCard icon={Plane} label="Aircraft" value={kpi.aircraft.toLocaleString()} sub="airborne (global)" href="/aviation" />
        <KpiCard icon={Car} label="Traffic" value={kpi.traffic ?? "—"} sub="Singapore sample" href="/city" />
        <KpiCard icon={Leaf} label="Air quality" value={kpi.aqi ?? "—"} sub={kpi.aqi != null && kpi.aqi <= 50 ? "Good" : "Check city"} href="/city" accent={kpi.aqi != null && kpi.aqi <= 50 ? "text-live" : undefined} />
        <KpiCard icon={CloudSun} label="Weather" value={cityWeather ? `${Math.round(cityWeather.temp)}°C` : "—"} sub={cityWeather?.condition ?? "Singapore"} href="/city" />
      </div>

      {/* Full-bleed map */}
      <section className="relative h-[min(62vh,680px)] w-full overflow-hidden border-y border-line bg-black">
        <MapView
          layers={mapLayers}
          lines={trackLines}
          highlightId={selected?.id}
          onSelect={(id) => setSelected(allMapItems.find((i) => i.id === id) ?? null)}
          defaultBasemap="dark"
          defaultGlobe
          autoRotate={autoRotate}
          rotateSpeed={0.035}
          zoom={1.5}
          className="h-full w-full [&>div:first-child]:rounded-none [&>div:first-child]:border-0"
        />

        {/* Layers panel — top right (below map basemap controls) */}
        <div className="hud-window absolute right-3 top-3 z-10 flex w-48 max-h-[min(380px,calc(100%-1.5rem))] flex-col gap-1 overflow-y-auto rounded-lg px-2.5 py-2 sm:top-[3.75rem]">
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
                  <span className="mono ml-auto text-[9px] text-ink-dim">{counts[key]}</span>
                </button>
              </div>
            );
          })}
          <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-line pt-1.5 text-[10px] uppercase tracking-wide text-ink-dim">
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} className="accent-[var(--color-live)]" />
            Auto rotate
          </label>
        </div>

        {selected && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3 sm:inset-x-auto sm:bottom-auto sm:right-52 sm:top-24 sm:w-[min(380px,calc(100%-1.5rem))] sm:justify-end">
            <div className="pointer-events-auto w-full max-w-md sm:max-w-none">
              <EntityDetailPanel item={selected} onClose={() => setSelected(null)} />
            </div>
          </div>
        )}
      </section>

      {/* Row below map — activity | signals | alerts */}
      <div className="grid min-w-0 gap-4 px-4 md:grid-cols-3 md:px-6">
        <section className="panel min-w-0 rounded-lg">
          <div className="panel-header gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><Activity className="h-3.5 w-3.5 shrink-0" /> Global activity</span>
            <Badge tone="live" pulse>Live</Badge>
          </div>
          <div className="max-h-[220px] overflow-y-auto p-2">
            {activity.map((it) => (
              <div key={it.id} className="rounded-md px-2 py-1.5 hover:bg-panel-2">
                <div className="truncate text-[12px] text-ink">{it.title}</div>
                <div className="text-[10px] text-ink-dim">{it.source} · {timeAgo(it.timestamp)}</div>
              </div>
            ))}
            {live.loading && (
              <div className="px-2 py-4">
                <Skeleton rows={4} />
              </div>
            )}
            {activity.length === 0 && !live.loading && <p className="px-2 py-4 text-xs text-ink-dim">No activity yet — run live seeder</p>}
          </div>
          <Link href="/search" className="block border-t border-line px-3 py-2 text-[11px] text-accent hover:underline">View all activity →</Link>
        </section>

        <section className="panel min-w-0 rounded-lg">
          <div className="panel-header gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><TrendingUp className="h-3.5 w-3.5 shrink-0" /> Top signals</span>
            <Link href="/search" className="shrink-0 normal-case tracking-normal text-accent">View all</Link>
          </div>
          <ol className="max-h-[220px] overflow-y-auto p-2 text-[11px]">
            {signals.map((s, i) => (
              <li key={s.id} className="mb-1.5 flex min-w-0 gap-2">
                <span className="mono shrink-0 text-ink-dim">{i + 1}.</span>
                <span className="min-w-0 truncate text-ink">{s.title}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel min-w-0 rounded-lg">
          <div className="panel-header gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Alerts</span>
            <Link href="/settings" className="shrink-0 normal-case tracking-normal text-accent">View all</Link>
          </div>
          <div className="max-h-[220px] overflow-y-auto p-2">
            {alerts.slice(0, 8).map((a, i) => (
              <div key={i} className="mb-1.5 flex min-w-0 items-start gap-1.5 text-[11px]">
                <Badge tone={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info"}>{a.severity}</Badge>
                <span className="min-w-0 truncate text-ink">{a.title}</span>
              </div>
            ))}
            {alerts.length === 0 && <p className="text-[11px] text-ink-dim">No active alerts</p>}
          </div>
        </section>
      </div>

      {/* Five panels */}
      <div className="grid gap-3 px-4 md:grid-cols-2 md:px-6 xl:grid-cols-3 2xl:grid-cols-5">
        <Panel title="Markets" icon={CandlestickChart} href="/markets">
          {markets.slice(0, 5).map((m) => (
            <div key={m.id} className="flex justify-between text-[11px]">
              <span className="truncate text-ink">{m.title}</span>
              <span className="mono text-ink-dim">{m.severityLabel ?? ""}</span>
            </div>
          ))}
        </Panel>
        <Panel title="City Digital Twin" icon={Building2} href="/city">
          <p className="text-[11px] text-ink">Singapore · sample viewport</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-ink-dim">
            <span>Traffic: {kpi.traffic ?? "—"}</span>
            <span>AQI: {kpi.aqi ?? "—"}</span>
          </div>
        </Panel>
        <Panel title="Aviation & Maritime" icon={Plane} href="/aviation">
          {live.flights.slice(0, 4).map((f) => (
            <div key={f.id} className="truncate text-[11px] text-ink">{f.title}</div>
          ))}
          <Link href="/maritime" className="mt-1 block text-[10px] text-accent">Maritime →</Link>
        </Panel>
        <Panel title="Investigations" icon={FolderOpen} href="/investigations">
          {investigations.slice(0, 3).map((inv) => (
            <div key={inv.id} className="text-[11px]">
              <span className="text-ink">{inv.title}</span>
              <span className="ml-1 text-ink-dim">· {inv.status}</span>
            </div>
          ))}
          {investigations.length === 0 && <p className="text-[11px] text-ink-dim">No open cases</p>}
        </Panel>
        <Panel title="Knowledge Graph" icon={Network} href="/graph">
          <p className="text-[11px] text-ink-dim">Cross-module entity relationships and convergence signals.</p>
        </Panel>
      </div>

      {/* Bottom ticker */}
      <div className="fixed bottom-0 left-12 right-0 z-20 flex h-8 items-center gap-2 border-t border-line bg-body/95 px-4 backdrop-blur lg:left-56">
        <Badge tone="live" pulse>LIVE FEED</Badge>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex gap-6 whitespace-nowrap text-[11px] text-soft">
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i}>· {t}</span>
            ))}
          </div>
        </div>
        <Link href="/search" className="shrink-0 text-[10px] text-accent">View all events →</Link>
      </div>
    </div>
  );
}

function Panel({
  title, icon: Icon, href, children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="panel rounded-lg p-3">
      <div className="panel-header -mx-3 -mt-3 mb-2 border-b border-line px-3 py-2">
        <span className="flex items-center gap-1.5 normal-case tracking-normal text-xs font-medium text-ink">
          <Icon className="h-3.5 w-3.5" /> {title}
        </span>
        <Link href={href} className="normal-case tracking-normal text-[10px] text-accent hover:underline">Open →</Link>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
