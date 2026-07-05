"use client";

import { useEffect, useState } from "react";

interface Quote {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  changePct: number;
  provider: string;
  dataDelay: string;
}

export function MarketsSnapshotPanel() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/markets/quotes?limit=12")
      .then((r) => r.json())
      .then((d) => {
        setQuotes(d.quotes ?? []);
        setDisclaimer(d.disclaimer ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[11px] text-ink-dim">Loading market quotes…</p>;

  return (
    <div className="space-y-2">
      {quotes.map((q) => (
        <div key={`${q.symbol}-${q.provider}`} className="flex items-baseline justify-between gap-2 border-b border-line/40 py-1">
          <div className="min-w-0">
            <div className="truncate text-[12px] text-ink">{q.name}</div>
            <div className="text-[10px] text-ink-dim">{q.provider} · {q.dataDelay}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="mono text-[12px] text-ink">{q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className={`mono text-[10px] ${q.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
      ))}
      {quotes.length === 0 && <p className="text-[11px] text-ink-dim">No quotes — check module:markets seed</p>}
      {disclaimer && <p className="pt-1 text-[9px] text-ink-dim">{disclaimer}</p>}
    </div>
  );
}
