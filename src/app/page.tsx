"use client";

// Situation Room — the daily-return view. Cross-stream convergence scoring
// surfaces the top developing situations across news, conflict, earth, cyber,
// markets and infrastructure, instead of presenting 20 disconnected modules.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Radar } from "lucide-react";
import { MODULES, moduleById } from "@/lib/modules";
import { computeSituations } from "@/lib/situation";
import type { Item } from "@/lib/types";
import { ItemCard, timeAgo } from "@/components/ModuleView";
import { ReaderPane } from "@/components/ReaderPane";
import { GlobeDashboard } from "@/components/GlobeDashboard";

interface Stats {
  quakes24h?: number;
  maxMag?: number;
  criticalCves?: number;
  kp?: number;
  incidents?: number;
  conflictEvents?: number;
}

const FEED_MODULES = ["earth", "cyber", "news", "conflict", "infrastructure", "macro"] as const;

export default function SituationRoom() {
  const [stats, setStats] = useState<Stats>({});
  const [pool, setPool] = useState<Item[]>([]);
  const [flights, setFlights] = useState<Item[]>([]);
  const [iss, setIss] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>();

  useEffect(() => {
    Promise.allSettled([
      ...FEED_MODULES.map((m) => fetch(`/api/modules/${m}`).then((r) => r.json())),
      fetch("/api/kindex").then((r) => r.json()),
    ]).then((results) => {
      const s: Stats = {};
      const all: Item[] = [];
      results.forEach((res, idx) => {
        if (res.status !== "fulfilled") return;
        if (idx === FEED_MODULES.length) {
          if (typeof res.value.kp === "number") s.kp = res.value.kp;
          return;
        }
        const items = (res.value.items ?? []) as Item[];
        all.push(...items);
        if (res.value.fetchedAt) setFetchedAt(res.value.fetchedAt);
        switch (FEED_MODULES[idx]) {
          case "earth": {
            const quakes = items.filter((i) => i.tags.includes("earthquake"));
            s.quakes24h = quakes.length;
            s.maxMag = quakes.reduce((m, q) => Math.max(m, q.severity ?? 0), 0);
            break;
          }
          case "cyber":
            s.criticalCves = items.filter((i) => (i.severity ?? 0) >= 9).length;
            break;
          case "infrastructure":
            s.incidents = items.length;
            break;
          case "conflict":
            s.conflictEvents = items.length;
            break;
        }
      });
      setStats(s);
      setPool(all);
    });

    // Globe-only live layers (not part of the situation pool).
    fetch("/api/flights?region=global").then((r) => r.json()).then((d) => setFlights(d.items ?? [])).catch(() => {});
    fetch("/api/iss").then((r) => r.json()).then((d) => {
      if (typeof d.lat !== "number") return;
      setIss([{
        id: "iss", module: "space", connectorId: "iss", title: "International Space Station",
        summary: d.altitudeKm != null ? `Altitude ${d.altitudeKm.toFixed(0)} km · ${d.velocityKmh?.toFixed(0)} km/h` : undefined,
        source: "wheretheiss.at", timestamp: d.timestamp, lat: d.lat, lon: d.lon,
        tags: ["iss"], entities: [], contentPolicy: "full_cache",
      }]);
    }).catch(() => {});
  }, []);

  const situations = useMemo(() => computeSituations(pool, { limit: 6 }), [pool]);

  const globeQuakes = useMemo(() => pool.filter((i) => i.tags.includes("earthquake")), [pool]);
  const globeEvents = useMemo(
    () => pool.filter((i) => typeof i.lat === "number" && !i.tags.includes("earthquake")),
    [pool],
  );

  const feed = useMemo(
    () =>
      [...pool]
        .filter((i) => (i.severity ?? 0) >= 4.5 || i.module === "news")
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 25),
    [pool],
  );

  const stat = (label: string, value: React.ReactNode, href: string, tone?: string) => (
    <Link key={label} href={href} className="rounded-lg border border-line bg-panel p-3 hover:bg-panel-2">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim">{label}</div>
      <div className={`mono mt-1 text-xl font-semibold ${tone ?? "text-ink"}`}>{value ?? "—"}</div>
    </Link>
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-4">
        <GlobeDashboard quakes={globeQuakes} flights={flights} events={globeEvents} iss={iss} />
      </div>

      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">
          Situation Room <span className="text-ink-dim">· cross-stream convergence on public data</span>
        </h1>
        <p className="mt-1 text-xs text-ink-dim">
          {fetchedAt ? `Feeds updated ${timeAgo(fetchedAt)} · ` : ""}
          situations rank by corroboration across independent modules, severity, and freshness.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        {stat("Earthquakes · 24h", stats.quakes24h, "/earth")}
        {stat("Max magnitude", stats.maxMag?.toFixed(1), "/earth", (stats.maxMag ?? 0) >= 6 ? "text-orange-400" : undefined)}
        {stat("Conflict events", stats.conflictEvents, "/conflict", (stats.conflictEvents ?? 0) > 0 ? "text-red-400" : undefined)}
        {stat("Critical CVEs · 7d", stats.criticalCves, "/cyber", (stats.criticalCves ?? 0) > 0 ? "text-red-400" : undefined)}
        {stat("Geomagnetic Kp", stats.kp?.toFixed(1), "/space", (stats.kp ?? 0) >= 5 ? "text-violet-400" : undefined)}
        {stat("Platform incidents", stats.incidents, "/infrastructure", (stats.incidents ?? 0) > 0 ? "text-amber-400" : undefined)}
      </div>

      <section className="mb-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
          <Radar className="h-4 w-4 text-accent" /> Developing situations
        </h2>
        {situations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-xs text-ink-dim">
            {pool.length === 0
              ? "Warming up connectors…"
              : "No multi-stream convergence right now — signals are isolated. Check individual modules."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {situations.map((s) => (
              <div key={s.key} className="rounded-lg border border-line bg-panel p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-ink">{s.region}</span>
                  <span
                    className={`mono shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      s.score >= 20 ? "bg-red-950/60 text-red-300" : s.score >= 10 ? "bg-amber-950/60 text-amber-300" : "bg-panel-2 text-ink-dim"
                    }`}
                    title="Convergence score: modules² ×2 + max severity + volume, decayed by freshness"
                  >
                    {s.score.toFixed(1)}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  {s.modules.map((m) => {
                    const def = moduleById(m);
                    return (
                      <Link
                        key={m}
                        href={def?.path ?? "/"}
                        className="rounded-full border border-line px-1.5 py-0.5 text-[10px] capitalize text-ink-dim hover:text-ink"
                      >
                        {def?.name ?? m}
                      </Link>
                    );
                  })}
                  <span className="ml-auto text-[10px] text-ink-dim">
                    {s.itemCount} signals · {timeAgo(s.latestAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {s.items.slice(0, 3).map((it) => (
                    <button
                      key={it.id}
                      onClick={() => setSelected(it)}
                      className="truncate text-left text-xs text-ink-dim hover:text-ink"
                      title={it.title}
                    >
                      <span className="mono text-[10px] text-ink-dim">[{it.source}]</span> {it.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
            <Activity className="h-4 w-4 text-accent" /> Cross-module feed
          </h2>
          <div className="flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {feed.length === 0 && <div className="py-8 text-xs text-ink-dim">Warming up connectors…</div>}
            {feed.map((it) => (
              <ItemCard key={it.id} item={it} selected={selected?.id === it.id} onSelect={() => setSelected(it)} />
            ))}
          </div>
        </section>

        <section>
          {selected ? (
            <div className="max-h-[55vh]">
              <ReaderPane item={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-sm font-medium text-ink">Modules</h2>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {MODULES.map((m) => (
                  <Link key={m.id} href={m.path}
                    className="group rounded-lg border border-line bg-panel p-3 transition-colors hover:bg-panel-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-ink">{m.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-dim transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-dim">{m.description}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
