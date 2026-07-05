"use client";

// Earth View — full intelligence-OS home: KPI strip, activity feed, map,
// signals, markets/city/aviation/investigations/graph panels, bottom ticker.

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Shield, CandlestickChart, Ship, Plane, Car, Leaf, CloudSun,
  Activity, TrendingUp, AlertTriangle, Network, FolderOpen, Building2,
} from "lucide-react";
import type { Item } from "@/lib/types";
import { MapView, type MapLayer } from "@/components/MapView";
import { Badge } from "@/components/Badge";
import { timeAgo } from "@/components/ModuleView";
import { useGlobeLiveData } from "@/lib/hooks/useGlobeLiveData";

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
    <Link href={href} className="rounded-lg border border-line bg-panel p-3 transition-colors hover:bg-panel-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-dim">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mono mt-1 text-xl font-semibold ${accent ?? "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-dim">{sub}</div>}
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

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/modules/earth").then((r) => r.json()),
      fetch("/api/modules/conflict").then((r) => r.json()),
      fetch("/api/modules/cyber").then((r) => r.json()),
      fetch("/api/modules/news").then((r) => r.json()),
      fetch("/api/modules/markets").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/investigations").then((r) => r.json()),
      fetch("/api/weather?lat=1.35&lon=103.82").then((r) => r.json()),
      fetch("/api/traffic?minLat=1.2&minLon=103.6&maxLat=1.5&maxLon=104.0").then((r) => r.json()),
    ]).then((results) => {
      const all: Item[] = [];
      results.slice(0, 4).forEach((res) => {
        if (res.status === "fulfilled" && res.value.items) {
          all.push(...(res.value.items as Item[]));
          if (res.value.fetchedAt) setFetchedAt(res.value.fetchedAt);
        }
      });
      setItems(all);

      if (results[4].status === "fulfilled") {
        const m = (results[4].value.items ?? []) as Item[];
        setMarkets(m);
        const sp = m.find((i) => i.title.includes("S&P") || i.tags.includes("^gspc"));
        const chg = sp?.extra?.change24h ?? sp?.severityLabel;
        if (chg != null) setKpi((k) => ({ ...k, spChange: `${Number(chg) >= 0 ? "+" : ""}${Number(chg).toFixed(2)}%` }));
      }

      if (results[5].status === "fulfilled") {
        const a = results[5].value.alerts ?? [];
        setAlerts(a);
        setKpi((k) => ({
          ...k,
          alerts: a.length,
          criticalAlerts: a.filter((x: { severity: string }) => x.severity === "critical").length,
        }));
      }

      if (results[6].status === "fulfilled") {
        setInvestigations(results[6].value.investigations ?? []);
      }

      if (results[7].status === "fulfilled" && typeof results[7].value.temperatureC === "number") {
        const w = results[7].value;
        setCityWeather({
          temp: w.temperatureC,
          condition: w.precipitationMm > 0 ? "Rain" : "Clear",
          humidity: w.humidity,
          wind: w.windKmh,
        });
        setKpi((k) => ({ ...k, aqi: w.aqiUs, weather: { temp: w.temperatureC, condition: "Cloudy", humidity: w.humidity, wind: w.windKmh } }));
      }

      if (results[8].status === "fulfilled" && results[8].value.enabled) {
        const segs = results[8].value.segments ?? [];
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

  const activity = useMemo(
    () => [...items, ...live.flights.slice(0, 5), ...live.ships.slice(0, 3)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 14),
    [items, live.flights, live.ships],
  );

  const signals = useMemo(
    () => [...items].filter((i) => (i.severity ?? 0) >= 5).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 6),
    [items],
  );

  const mapLayers = useMemo((): MapLayer[] => [
    { id: "events", color: "#38bdf8", items: live.events.slice(0, 200), radius: 4 },
    { id: "quakes", color: "#fb923c", items: live.quakes.slice(0, 100), radius: 3 },
    { id: "flights", color: "#39ff8f", items: live.flights.slice(0, 400), radius: 2, icon: "plane" },
  ], [live.events, live.quakes, live.flights]);

  const tickerItems = useMemo(
    () => activity.map((i) => i.title).slice(0, 20),
    [activity],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-10">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Earth View</h1>
          <p className="text-[11px] text-ink-dim">GLOBAL INTELLIGENCE OS</p>
        </div>
        <Badge tone="live" pulse>● LIVE — All Systems Operational</Badge>
        {fetchedAt && <span className="mono text-[10px] text-ink-dim">updated {timeAgo(fetchedAt)}</span>}
        <Link href="/dashboard" className="ml-auto text-[11px] text-accent hover:underline">
          Open globe dashboard →
        </Link>
      </div>

      {/* Row 1 — KPI strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard icon={Shield} label="Live alerts" value={kpi.alerts} sub={`${kpi.criticalAlerts} critical`} href="/settings" accent={kpi.criticalAlerts > 0 ? "text-critical" : undefined} />
        <KpiCard icon={CandlestickChart} label="Markets" value={kpi.spChange ?? "—"} sub="S&P 500" href="/markets" accent={kpi.spChange?.startsWith("+") ? "text-live" : kpi.spChange?.startsWith("-") ? "text-critical" : undefined} />
        <KpiCard icon={Ship} label="Vessels" value={kpi.vessels.toLocaleString()} sub={`${live.meta.shipsStale ? "stale" : "live"} AIS`} href="/maritime" />
        <KpiCard icon={Plane} label="Aircraft" value={kpi.aircraft.toLocaleString()} sub="airborne (global)" href="/aviation" />
        <KpiCard icon={Car} label="Traffic" value={kpi.traffic ?? "—"} sub="Singapore sample" href="/city" />
        <KpiCard icon={Leaf} label="Air quality" value={kpi.aqi ?? "—"} sub={kpi.aqi != null && kpi.aqi <= 50 ? "Good" : "Check city"} href="/city" accent={kpi.aqi != null && kpi.aqi <= 50 ? "text-live" : undefined} />
        <KpiCard icon={CloudSun} label="Weather" value={cityWeather ? `${Math.round(cityWeather.temp)}°C` : "—"} sub={cityWeather?.condition ?? "Singapore"} href="/city" />
      </div>

      {/* Row 2 — activity | map | signals */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink"><Activity className="h-3.5 w-3.5" /> Global activity</span>
            <Badge tone="live" pulse>Live</Badge>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {activity.map((it) => (
              <div key={it.id} className="rounded-md px-2 py-1.5 hover:bg-panel-2">
                <div className="truncate text-[12px] text-ink">{it.title}</div>
                <div className="text-[10px] text-ink-dim">{it.source} · {timeAgo(it.timestamp)}</div>
              </div>
            ))}
            {activity.length === 0 && <p className="px-2 py-4 text-xs text-ink-dim">Warming up feeds…</p>}
          </div>
          <Link href="/search" className="block border-t border-line px-3 py-2 text-[11px] text-accent hover:underline">View all activity →</Link>
        </section>

        <section className="relative min-h-[320px] overflow-hidden rounded-lg border border-line">
          <MapView layers={mapLayers} defaultBasemap="dark" defaultGlobe autoRotate zoom={1.8} className="h-[320px] w-full" />
          <div className="absolute bottom-2 left-2 rounded bg-panel-hud/90 px-2 py-0.5 text-[10px] text-ink-dim backdrop-blur">
            Geopolitical · Aviation · Quakes
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink"><TrendingUp className="h-3.5 w-3.5" /> Top signals</span>
              <Link href="/search" className="text-[10px] text-accent">View all</Link>
            </div>
            <ol className="max-h-[140px] overflow-y-auto p-2 text-[11px]">
              {signals.map((s, i) => (
                <li key={s.id} className="mb-1.5 flex gap-2">
                  <span className="mono text-ink-dim">{i + 1}.</span>
                  <span className="text-ink">{s.title}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink"><AlertTriangle className="h-3.5 w-3.5" /> Alerts</span>
              <Link href="/settings" className="text-[10px] text-accent">View all</Link>
            </div>
            <div className="max-h-[140px] overflow-y-auto p-2">
              {alerts.slice(0, 6).map((a, i) => (
                <div key={i} className="mb-1.5 text-[11px]">
                  <Badge tone={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info"}>{a.severity}</Badge>
                  <span className="ml-1 text-ink">{a.title}</span>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-[11px] text-ink-dim">No active alerts</p>}
            </div>
          </div>
        </section>
      </div>

      {/* Row 3 — five panels */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink"><Icon className="h-3.5 w-3.5" /> {title}</span>
        <Link href={href} className="text-[10px] text-accent hover:underline">Open →</Link>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
