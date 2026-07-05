"use client";

// Quick-look drawer panels for the Dashboard rail. Each panel fetches its own
// data lazily when opened and renders over the globe without a page nav. Only
// one is open at a time (owned by the parent).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Play } from "lucide-react";
import type { Item } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { timeAgo } from "@/components/ModuleView";
import { LIVE_CHANNELS } from "@/lib/config/live-channels";

export type QuickKind = "wire" | "stocks" | "streams" | "predictions" | "cameras" | "defcon" | "outbreaks";

const TITLES: Record<QuickKind, string> = {
  wire: "Wire — live headlines",
  stocks: "Stocks — live tickers",
  streams: "Streams — live news TV",
  predictions: "Predictions — watch signals",
  cameras: "Cameras — traffic CCTV & webcams",
  defcon: "Defcon — alert posture",
  outbreaks: "Outbreaks — health & humanitarian",
};

async function getItems(module: string): Promise<Item[]> {
  try {
    const d = await fetch(`/api/modules/${module}`).then((r) => r.json());
    return (d.items ?? []) as Item[];
  } catch {
    return [];
  }
}

export function QuickPanel({ kind, onClose }: { kind: QuickKind; onClose: () => void }) {
  return (
    <div className="hud-window absolute bottom-11 left-4 top-4 z-30 flex w-[340px] max-w-[calc(100%-2rem)] flex-col rounded-lg">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-widest text-ink">{TITLES[kind]}</span>
        <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {kind === "wire" && <WirePanel />}
        {kind === "stocks" && <StocksPanel />}
        {kind === "streams" && <StreamsPanel />}
        {kind === "predictions" && <PredictionsPanel />}
        {kind === "cameras" && <CamerasPanel />}
        {kind === "defcon" && <DefconPanel />}
        {kind === "outbreaks" && <OutbreaksPanel />}
      </div>
    </div>
  );
}

function WirePanel() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    Promise.all([getItems("news"), getItems("conflict")]).then(([a, b]) =>
      setItems([...a, ...b].sort((x, y) => y.timestamp.localeCompare(x.timestamp)).slice(0, 40)),
    );
  }, []);
  if (!items.length) return <Loading />;
  return (
    <div className="flex flex-col gap-1">
      {items.map((i) => (
        <a key={i.id} href={i.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1.5 hover:bg-panel-2">
          <div className="text-[12px] leading-snug text-ink">{i.title}</div>
          <div className="mt-0.5 text-[10px] text-ink-dim">{i.source} · {timeAgo(i.timestamp)}</div>
        </a>
      ))}
    </div>
  );
}

function StocksPanel() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => { getItems("markets").then((d) => setItems(d.slice(0, 40))); }, []);
  if (!items.length) return <Loading />;
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((i) => {
        const chg = Number(i.extra?.change24h ?? 0);
        return (
          <div key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel-2">
            <span className="truncate text-[12px] text-ink">{i.title}</span>
            <span className="mono ml-auto text-[11px] text-ink-dim">
              {i.extra?.price != null ? `$${Number(i.extra.price).toLocaleString()}` : ""}
            </span>
            <span className={`mono w-14 text-right text-[11px] ${chg >= 0 ? "text-live" : "text-critical"}`}>
              {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
            </span>
          </div>
        );
      })}
      <Link href="/markets" className="mt-1 px-2 text-[11px] text-accent hover:underline">View full markets →</Link>
    </div>
  );
}

const STREAM_CHANNELS = LIVE_CHANNELS.filter((c) => c.category === "news" || c.category === "finance");

function StreamsPanel() {
  const [active, setActive] = useState(STREAM_CHANNELS[0]);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {STREAM_CHANNELS.slice(0, 12).map((c) => (
          <button
            key={c.id}
            onClick={() => { setActive(c); setPlaying(false); }}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${active.id === c.id ? "border-accent text-accent" : "border-line text-ink-dim hover:text-ink"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        {playing ? (
          <iframe
            title={active.name}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${active.videoId}?autoplay=1&mute=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <button onClick={() => setPlaying(true)} className="group absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${active.videoId}/hqdefault.jpg`} alt={active.name} className="h-full w-full object-cover opacity-70" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white">
                <Play className="h-3.5 w-3.5" /> Play Live Feed
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="text-[10px] text-ink-dim">{active.provider} · official public stream</div>
    </div>
  );
}

function PredictionsPanel() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    Promise.all([getItems("cyber"), getItems("conflict"), getItems("earth")]).then((all) =>
      setItems(all.flat().filter((i) => (i.severity ?? 0) >= 4).sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0)).slice(0, 20)),
    );
  }, []);
  if (!items.length) return <Loading />;
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 pb-1 text-[10px] text-ink-dim">
        Watch signals ranked by severity — leading indicators, not market odds.
      </p>
      {items.map((i) => (
        <div key={i.id} className="rounded-md px-2 py-1.5 hover:bg-panel-2">
          <div className="flex items-center gap-2">
            <Badge tone={(i.severity ?? 0) >= 6 ? "critical" : "warning"}>{(i.severity ?? 0).toFixed(1)}</Badge>
            <span className="truncate text-[12px] text-ink">{i.title}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-ink-dim">{i.source} · {timeAgo(i.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}

interface Webcam { id: string; title: string; place?: string; region: string; videoId?: string; thumbnail?: string; url: string; provider: string }
interface CctvCam { id: string; title: string; region: string; imageUrl: string; refreshSeconds: number; source: string; lastSeenAt: string }

const CAM_REGIONS = ["all", "London", "Seattle", "California", "NYC", "Melbourne", "middle-east", "europe", "americas", "asia", "space"] as const;

function CamerasPanel() {
  const [cams, setCams] = useState<Webcam[]>([]);
  const [cctv, setCctv] = useState<CctvCam[]>([]);
  const [region, setRegion] = useState<(typeof CAM_REGIONS)[number]>("all");
  const [tab, setTab] = useState<"cctv" | "webcams">("cctv");

  useEffect(() => {
    Promise.all([
      fetch("/api/cctv").then((r) => r.json()).then((d) => setCctv(d.cameras ?? [])).catch(() => {}),
      fetch("/api/webcams").then((r) => r.json()).then((d) => setCams(d.items ?? [])).catch(() => {}),
    ]);
  }, []);

  const shownCctv = useMemo(
    () => cctv.filter((c) => region === "all" || c.region === region),
    [cctv, region],
  );
  const shownWeb = useMemo(
    () => cams.filter((c) => region === "all" || c.region === region),
    [cams, region],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["cctv", "webcams"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${tab === t ? "border-accent text-accent" : "border-line text-ink-dim hover:text-ink"}`}>
            {t === "cctv" ? "Traffic CCTV" : "Web streams"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {CAM_REGIONS.map((r) => (
          <button key={r} onClick={() => setRegion(r)}
            className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${region === r ? "border-accent text-accent" : "border-line text-ink-dim hover:text-ink"}`}>
            {r.replace("-", " ")}
          </button>
        ))}
      </div>
      {tab === "cctv" ? (
        !cctv.length ? <Loading /> : (
          <div className="grid grid-cols-2 gap-2">
            {shownCctv.map((c) => (
              <a key={c.id} href={c.imageUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border border-line">
                <div className="relative aspect-video bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl} alt={c.title} className="h-full w-full object-cover opacity-80 group-hover:opacity-100" loading="lazy" />
                </div>
                <div className="px-1.5 py-1 text-[10px] text-ink">{c.title}</div>
                <div className="px-1.5 pb-1 text-[9px] text-ink-dim">
                  Snapshot · ~{Math.max(1, Math.round(c.refreshSeconds / 60))} min · {c.source}
                </div>
              </a>
            ))}
          </div>
        )
      ) : !cams.length ? <Loading /> : (
        <div className="grid grid-cols-2 gap-2">
          {shownWeb.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md border border-line">
              <div className="relative aspect-video bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover opacity-75 group-hover:opacity-100" loading="lazy" />}
                <span className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white/90" />
                </span>
              </div>
              <div className="px-1.5 py-1 text-[10px] text-ink">{c.place ?? c.title}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DefconPanel() {
  const [level, setLevel] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<{ label: string; n: number }[]>([]);
  useEffect(() => {
    Promise.all([getItems("cyber"), getItems("conflict"), getItems("earth")]).then(([cyber, conflict, earth]) => {
      const critCyber = cyber.filter((i) => (i.severity ?? 0) >= 9).length;
      const armed = conflict.filter((i) => i.tags.includes("armed-conflict")).length;
      const bigQuakes = earth.filter((i) => i.tags.includes("earthquake") && (i.severity ?? 0) >= 6).length;
      const stress = critCyber * 2 + armed + bigQuakes * 2;
      // 5 = lowest readiness state, 1 = highest. More stress → lower number.
      const lvl = stress >= 12 ? 2 : stress >= 7 ? 3 : stress >= 3 ? 4 : 5;
      setLevel(lvl);
      setDrivers([
        { label: "Critical CVEs", n: critCyber },
        { label: "Armed-conflict events", n: armed },
        { label: "M6+ earthquakes", n: bigQuakes },
      ]);
    });
  }, []);
  const color = level == null ? "text-ink" : level <= 2 ? "text-critical" : level === 3 ? "text-warning" : "text-live";
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="text-[10px] uppercase tracking-widest text-ink-dim">Composite readiness</div>
      <div className={`mono text-6xl font-bold ${color}`}>{level == null ? "—" : `DEF${level}`}</div>
      <p className="px-3 text-center text-[11px] text-ink-dim">
        Derived from live signal load — a heuristic posture indicator, not an official DEFCON.
      </p>
      <div className="w-full border-t border-line pt-2">
        {drivers.map((d) => (
          <div key={d.label} className="flex items-center justify-between px-2 py-1 text-[11px]">
            <span className="text-ink-dim">{d.label}</span>
            <span className="mono text-ink">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutbreaksPanel() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    getItems("conflict").then((d) =>
      setItems(
        d.filter((i) => /health|disease|outbreak|cholera|measles|ebola|epidemic|nutrition|famine/i.test(i.title + (i.summary ?? "")))
          .slice(0, 25),
      ),
    );
  }, []);
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 pb-1 text-[10px] text-ink-dim">Health & humanitarian signals from ReliefWeb.</p>
      {items.length === 0 ? <div className="px-2 py-4 text-[11px] text-ink-dim">No active health signals in the current feed.</div> : items.map((i) => (
        <a key={i.id} href={i.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-md px-2 py-1.5 hover:bg-panel-2">
          <div className="text-[12px] leading-snug text-ink">{i.title}</div>
          <div className="mt-0.5 text-[10px] text-ink-dim">{i.source} · {timeAgo(i.timestamp)}</div>
        </a>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="px-2 py-6 text-center text-[11px] text-ink-dim">Loading…</div>;
}
