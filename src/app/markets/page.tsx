"use client";

// Markets — Bloomberg-style dashboard with stocks / crypto / indices tabs
// and CoinGecko-style in-app asset detail (overview, chart, stats, news, AI insights).

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import type { Item } from "@/lib/types";
import { ItemCard, timeAgo } from "@/components/ModuleView";
import { PriceChart } from "@/components/PriceChart";
import { Skeleton } from "@/components/Skeleton";

type Tab = "crypto" | "stocks" | "indices";

interface InstrumentRow {
  id: string;
  symbol: string;
  name: string;
  instrumentType: string;
  exchange?: string;
}

interface MarketInsight {
  outlook: string;
  confidence: number;
  horizon: string;
  risks: string[];
  catalysts: string[];
  narrative: string;
  aiEnabled: boolean;
  disclaimer: string;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline fill="none" stroke={up ? "#16a34a" : "#dc2626"} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
      <span className="text-ink-dim">{label}</span>
      <span className="mono text-ink">{value}</span>
    </div>
  );
}

function outlookColor(outlook: string): string {
  if (outlook === "bullish") return "text-emerald-500";
  if (outlook === "bearish") return "text-red-500";
  return "text-ink-dim";
}

function AssetDetail({ item, onClose }: { item: Item; onClose: () => void }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"overview" | "news" | "insights">("overview");
  const [news, setNews] = useState<Item[]>([]);
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const isCrypto = item.tags.includes("crypto");
  const coinId = (item.extra?.coinId as string) ?? item.id.replace("crypto:", "");
  const stockSym = (item.extra?.symbol as string) ?? item.id.replace("stock:", "");
  const displayName = item.title.split("(")[0].trim();

  useEffect(() => {
    setDetail(null);
    setInsight(null);
    fetch(`/api/markets/detail?kind=${isCrypto ? "crypto" : "stock"}&id=${encodeURIComponent(isCrypto ? coinId : stockSym)}`)
      .then((r) => r.json())
      .then((d) => !d.error && setDetail(d));
    fetch(`/api/search?q=${encodeURIComponent(displayName)}&briefing=0`)
      .then((r) => r.json())
      .then((d) => {
        const all: Item[] = Object.values(d.grouped ?? {}).flat() as Item[];
        setNews(all.filter((i) => i.module === "news").slice(0, 8));
      });
  }, [item, isCrypto, coinId, stockSym, displayName]);

  useEffect(() => {
    const change = Number(item.extra?.change24h ?? detail?.change24h ?? 0);
    const price = Number(item.extra?.price ?? detail?.price ?? 0);
    const params = new URLSearchParams({
      q: displayName,
      symbol: isCrypto ? coinId : stockSym,
      kind: isCrypto ? "crypto" : item.tags.includes("index") ? "index" : "stock",
      changePct: String(change),
    });
    if (price > 0) params.set("price", String(price));
    fetch(`/api/v1/markets/insights?${params}`)
      .then((r) => r.json())
      .then((d) => d.insight && setInsight(d.insight));
  }, [item, detail, isCrypto, coinId, stockSym, displayName]);

  const change = Number(item.extra?.change24h ?? detail?.change24h ?? 0);
  const change7d = Number(item.extra?.change7d ?? detail?.change7d ?? 0);
  const up = change >= 0;
  const price = Number(item.extra?.price ?? detail?.price ?? 0);
  const currency = String(detail?.currency ?? item.extra?.currency ?? "USD");

  const tabs = ["overview", "insights", "news"] as const;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="border-b border-line p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">
              {item.source} · {String(item.extra?.exchange ?? detail?.exchange ?? "—")}
            </div>
            <h2 className="text-xl font-semibold text-ink">{item.title}</h2>
          </div>
          <button onClick={onClose} className="rounded border border-line px-2 py-1 text-xs text-ink-dim hover:text-ink">✕</button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="mono text-3xl font-semibold text-ink">
            {price > 0 ? (
              <>
                {currency === "USD" ? "$" : ""}
                {price.toLocaleString(undefined, {
                  maximumFractionDigits: currency === "INR" ? 2 : price < 1 ? 6 : 2,
                })}
                {currency !== "USD" ? ` ${currency}` : ""}
              </>
            ) : "—"}
          </span>
          {price > 0 && (
            <span className={`flex items-center gap-1 text-sm font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
              {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {up ? "+" : ""}{change.toFixed(2)}% (24h)
              {change7d !== 0 && (
                <span className="text-ink-dim"> · 7d {change7d >= 0 ? "+" : ""}{change7d.toFixed(2)}%</span>
              )}
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-1">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs capitalize ${tab === t ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "overview" && (
          <>
            <PriceChart
              symbol={isCrypto ? coinId : stockSym}
              kind={isCrypto ? "crypto" : "stock"}
              label={item.title}
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">Market stats</h3>
                {isCrypto && detail ? (
                  <>
                    <StatRow label="Market cap" value={`$${Number(detail.marketCap).toLocaleString(undefined, { notation: "compact" })}`} />
                    <StatRow label="24h volume" value={`$${Number(detail.volume24h).toLocaleString(undefined, { notation: "compact" })}`} />
                    <StatRow label="FDV" value={`$${Number(detail.fdv ?? 0).toLocaleString(undefined, { notation: "compact" })}`} />
                    <StatRow label="Circulating" value={Number(detail.circulating).toLocaleString()} />
                    <StatRow label="24h high / low" value={`$${Number(detail.high24h).toFixed(2)} / $${Number(detail.low24h).toFixed(2)}`} />
                  </>
                ) : (
                  <>
                    <StatRow label="Price" value={price > 0 ? price.toLocaleString() : "—"} />
                    <StatRow label="Day change" value={`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`} />
                    <StatRow label="Exchange" value={String(detail?.exchange ?? item.extra?.exchange ?? "—")} />
                    <StatRow label="52w range" value={detail?.high52 ? `$${Number(detail.high52).toFixed(0)} – $${Number(detail.low52).toFixed(0)}` : "—"} />
                    <StatRow label="Provider" value={String(detail?.provider ?? item.extra?.provider ?? "—")} />
                  </>
                )}
              </div>
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">About</h3>
                {detail?.description ? (
                  <p className="text-sm leading-relaxed text-soft">{String(detail.description).slice(0, 400)}…</p>
                ) : (
                  <p className="text-sm text-ink-dim">{item.summary}</p>
                )}
                {typeof detail?.homepage === "string" && detail.homepage && (
                  <a href={detail.homepage} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent hover:underline">Official site</a>
                )}
              </div>
            </div>
          </>
        )}
        {tab === "insights" && (
          <div className="space-y-3">
            {!insight && <p className="text-xs text-ink-dim">Generating outlook…</p>}
            {insight && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${outlookColor(insight.outlook)}`}>
                    {insight.outlook}
                  </span>
                  <span className="text-xs text-ink-dim">Confidence {(insight.confidence * 100).toFixed(0)}% · {insight.horizon}</span>
                  {!insight.aiEnabled && (
                    <span className="text-[10px] text-ink-dim">Set GEMINI_API_KEY for full AI analysis</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-soft">{insight.narrative}</p>
                {insight.risks.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-ink-dim">Risk flags</h4>
                    <ul className="list-inside list-disc text-xs text-soft">
                      {insight.risks.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {insight.catalysts.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-ink-dim">Catalysts</h4>
                    <ul className="list-inside list-disc text-xs text-soft">
                      {insight.catalysts.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[10px] text-ink-dim">{insight.disclaimer}</p>
              </>
            )}
          </div>
        )}
        {tab === "news" && (
          <div className="flex flex-col gap-1.5">
            {news.map((n) => <ItemCard key={n.id} item={n} selected={false} onSelect={() => {}} />)}
            {news.length === 0 && <p className="text-xs text-ink-dim">No related news found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function instrumentToItem(inst: InstrumentRow, live?: Item): Item {
  if (live) return live;
  return {
    id: `stock:${inst.symbol}`,
    module: "markets",
    connectorId: "seed",
    title: `${inst.name} (${inst.symbol.replace("^", "")})`,
    summary: `${inst.exchange ?? "Global"} · awaiting live quote`,
    source: inst.exchange ?? "Seed",
    timestamp: new Date().toISOString(),
    severity: 0,
    severityLabel: "—",
    tags: inst.instrumentType === "index" ? ["index"] : ["equity"],
    entities: [{ name: inst.name, type: "instrument" }],
    contentPolicy: "full_cache",
    extra: {
      symbol: inst.symbol,
      exchange: inst.exchange,
      assetClass: inst.instrumentType,
      price: 0,
      change24h: 0,
    },
  };
}

function matchesSearch(item: Item, q: string): boolean {
  const t = q.toLowerCase();
  const sym = String(item.extra?.symbol ?? "").toLowerCase();
  const exch = String(item.extra?.exchange ?? "").toLowerCase();
  return (
    item.title.toLowerCase().includes(t) ||
    item.summary?.toLowerCase().includes(t) ||
    sym.includes(t) ||
    exch.includes(t)
  );
}

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>("crypto");
  const [items, setItems] = useState<Item[]>([]);
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/modules/markets").then((r) => r.json()),
      fetch("/api/v1/markets/instruments").then((r) => r.json()),
    ])
      .then(([mod, inst]) => {
        setItems(mod.items ?? []);
        setInstruments(inst.instruments ?? []);
        setFetchedAt(mod.fetchedAt);
      })
      .finally(() => setLoading(false));
  }, []);

  const liveBySymbol = useMemo(() => {
    const map = new Map<string, Item>();
    for (const i of items) {
      const sym = String(i.extra?.symbol ?? i.id.replace(/^(crypto|stock):/, "")).toUpperCase();
      map.set(sym, i);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    if (tab === "crypto") {
      let list = items.filter((i) => i.tags.includes("crypto"));
      if (q.trim()) list = list.filter((i) => matchesSearch(i, q));
      return list;
    }

    const instType = tab === "indices" ? "index" : "equity";
    const seeded = instruments
      .filter((i) => i.instrumentType === instType)
      .map((inst) => instrumentToItem(inst, liveBySymbol.get(inst.symbol.toUpperCase())));

    const seededIds = new Set(seeded.map((s) => s.id));
    const extras = items.filter(
      (i) => !i.tags.includes("crypto") && i.tags.includes(instType === "index" ? "index" : "equity") && !seededIds.has(i.id),
    );

    let list = [...seeded, ...extras];
    if (q.trim()) list = list.filter((i) => matchesSearch(i, q));
    return list.sort((a, b) => Number(b.extra?.price ?? 0) - Number(a.extra?.price ?? 0));
  }, [items, instruments, tab, q, liveBySymbol]);

  const movers = useMemo(() =>
    [...filtered]
      .filter((m) => Number(m.extra?.price ?? 0) > 0)
      .sort((a, b) => Math.abs(Number(b.extra?.change24h ?? 0)) - Math.abs(Number(a.extra?.change24h ?? 0)))
      .slice(0, 4),
  [filtered]);

  return (
    <div className="panel mx-auto max-w-7xl rounded-lg">
      <div className="panel-header">
        <h1 className="flex items-center gap-2 normal-case tracking-normal text-xs font-medium text-ink">
          <TrendingUp className="h-4 w-4 text-live" /> Markets
        </h1>
        {fetchedAt && <span className="normal-case tracking-normal">Updated {timeAgo(fetchedAt)}</span>}
      </div>
      <div className="panel-tabs">
        {(["crypto", "stocks", "indices"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSelected(null); }}
            className={`panel-tab capitalize ${tab === t ? "active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search symbol, name, exchange…"
          className="ml-auto w-56 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
        />
      </div>

      <div className="p-4">

      {!loading && movers.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {movers.map((m) => {
            const ch = Number(m.extra?.change24h ?? 0);
            const up = ch >= 0;
            return (
              <button key={m.id} onClick={() => setSelected(m)}
                className="rounded-lg border border-line bg-panel p-3 text-left hover:bg-panel-2">
                <div className="truncate text-xs font-medium text-ink">{m.title.split("(")[0].trim()}</div>
                <div className="mono mt-1 text-lg font-semibold text-ink">${Number(m.extra?.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div className={`text-xs ${up ? "text-emerald-500" : "text-red-500"}`}>{up ? "+" : ""}{ch.toFixed(2)}%</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          {loading ? (
            <Skeleton rows={8} />
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-line p-6 text-center text-sm text-ink-dim">
              No instruments match. Try another tab or search term.
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-panel-2 text-[11px] uppercase tracking-wide text-ink-dim">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">24h</th>
                    <th className="hidden px-3 py-2 md:table-cell">7d</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => {
                    const ch = Number(m.extra?.change24h ?? 0);
                    const up = ch >= 0;
                    const spark = m.extra?.sparkline as number[] | undefined;
                    const price = Number(m.extra?.price ?? 0);
                    return (
                      <tr key={m.id} onClick={() => setSelected(m)}
                        className={`cursor-pointer border-t border-line hover:bg-panel-2 ${selected?.id === m.id ? "bg-panel-2" : ""}`}>
                        <td className="px-3 py-2 text-ink-dim">{Number(m.extra?.rank) || i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-ink">{m.title.split("(")[0].trim()}</div>
                          <div className="text-ink-dim">{String(m.extra?.symbol ?? m.source)} · {String(m.extra?.exchange ?? m.source)}</div>
                        </td>
                        <td className="mono px-3 py-2 text-right text-ink">
                          {price > 0 ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}
                        </td>
                        <td className={`hidden px-3 py-2 text-right sm:table-cell ${price > 0 ? (up ? "text-emerald-500" : "text-red-500") : "text-ink-dim"}`}>
                          {price > 0 ? `${up ? "+" : ""}${ch.toFixed(2)}%` : "—"}
                        </td>
                        <td className="hidden px-3 py-2 md:table-cell">{spark ? <Sparkline data={spark} up={(spark.at(-1) ?? 0) >= (spark[0] ?? 0)} /> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="min-h-[60vh]">
          {selected ? (
            <AssetDetail item={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-dim">
              Select an instrument for overview, chart, stats, news &amp; AI insights — all in-app.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
