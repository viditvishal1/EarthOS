"use client";

// Markets — Bloomberg-style dashboard with stocks / crypto / indices tabs
// and CoinGecko-style in-app asset detail (overview, chart, stats, news).

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, TrendingUp } from "lucide-react";
import type { Item } from "@/lib/types";
import { ItemCard, timeAgo } from "@/components/ModuleView";
import { PriceChart } from "@/components/PriceChart";

type Tab = "crypto" | "stocks" | "indices";

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

function AssetDetail({ item, onClose }: { item: Item; onClose: () => void }) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"overview" | "news">("overview");
  const [news, setNews] = useState<Item[]>([]);
  const isCrypto = item.tags.includes("crypto");
  const coinId = (item.extra?.coinId as string) ?? item.id.replace("crypto:", "");
  const stockSym = (item.extra?.symbol as string) ?? item.id.replace("stock:", "");

  useEffect(() => {
    setDetail(null);
    fetch(`/api/markets/detail?kind=${isCrypto ? "crypto" : "stock"}&id=${encodeURIComponent(isCrypto ? coinId : stockSym)}`)
      .then((r) => r.json())
      .then((d) => !d.error && setDetail(d));
    fetch(`/api/search?q=${encodeURIComponent(item.title.split("(")[0].trim())}&briefing=0`)
      .then((r) => r.json())
      .then((d) => {
        const all: Item[] = Object.values(d.grouped ?? {}).flat() as Item[];
        setNews(all.filter((i) => i.module === "news").slice(0, 8));
      });
  }, [item, isCrypto, coinId, stockSym]);

  const change = Number(item.extra?.change24h ?? detail?.change24h ?? 0);
  const up = change >= 0;
  const price = Number(item.extra?.price ?? detail?.price ?? 0);

  const tabs = ["overview", "news"] as const;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="border-b border-line p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-dim">{item.source} · #{String(detail?.rank ?? item.extra?.rank ?? "—")}</div>
            <h2 className="text-xl font-semibold text-ink">{item.title}</h2>
          </div>
          <button onClick={onClose} className="rounded border border-line px-2 py-1 text-xs text-ink-dim hover:text-ink">✕</button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="mono text-3xl font-semibold text-ink">${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })}</span>
          <span className={`flex items-center gap-1 text-sm font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
            {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {up ? "+" : ""}{change.toFixed(2)}% (24h)
          </span>
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
                    <StatRow label="Price" value={`$${price.toLocaleString()}`} />
                    <StatRow label="Day change" value={`${change >= 0 ? "+" : ""}${change.toFixed(2)}%`} />
                    <StatRow label="Exchange" value={String(detail?.exchange ?? "—")} />
                    <StatRow label="52w range" value={detail ? `$${Number(detail.low52).toFixed(0)} – $${Number(detail.high52).toFixed(0)}` : "—"} />
                  </>
                )}
              </div>
              <div className="rounded-lg border border-line bg-panel-2 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">Insights</h3>
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

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>("crypto");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/modules/markets")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setFetchedAt(d.fetchedAt);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "crypto") list = items.filter((i) => i.tags.includes("crypto"));
    else if (tab === "indices") list = items.filter((i) => i.tags.includes("index"));
    else list = items.filter((i) => i.tags.includes("equity"));
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(t) || i.summary?.toLowerCase().includes(t));
    }
    return list;
  }, [items, tab, q]);

  const movers = useMemo(() =>
    [...filtered].sort((a, b) => Math.abs(Number(b.extra?.change24h ?? 0)) - Math.abs(Number(a.extra?.change24h ?? 0))).slice(0, 4),
  [filtered]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <TrendingUp className="h-5 w-5 text-emerald-500" /> Markets
        </h1>
        <div className="flex rounded-lg border border-line bg-panel p-0.5">
          {(["crypto", "stocks", "indices"] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setSelected(null); }}
              className={`rounded-md px-3 py-1.5 text-xs capitalize ${tab === t ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink"}`}>
              {t}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search instruments…"
          className="ml-auto w-48 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none" />
        {fetchedAt && <span className="text-[11px] text-ink-dim">Updated {timeAgo(fetchedAt)}</span>}
      </div>

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
            <div className="flex items-center gap-2 py-8 text-sm text-ink-dim"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading markets…</div>
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
                    return (
                      <tr key={m.id} onClick={() => setSelected(m)}
                        className={`cursor-pointer border-t border-line hover:bg-panel-2 ${selected?.id === m.id ? "bg-panel-2" : ""}`}>
                        <td className="px-3 py-2 text-ink-dim">{Number(m.extra?.rank) || i + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-ink">{m.title.split("(")[0].trim()}</div>
                          <div className="text-ink-dim">{m.source}</div>
                        </td>
                        <td className="mono px-3 py-2 text-right text-ink">${Number(m.extra?.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className={`hidden px-3 py-2 text-right sm:table-cell ${up ? "text-emerald-500" : "text-red-500"}`}>{up ? "+" : ""}{ch.toFixed(2)}%</td>
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
              Select an instrument for CoinGecko-style overview, chart, stats &amp; news — all in-app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
