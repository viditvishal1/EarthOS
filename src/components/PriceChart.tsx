"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { LoaderCircle } from "lucide-react";

const RANGES = [
  { id: "1", label: "24H", days: 1, interval: "hourly" as const },
  { id: "7", label: "7D", days: 7, interval: "daily" as const },
  { id: "30", label: "1M", days: 30, interval: "daily" as const },
  { id: "90", label: "3M", days: 90, interval: "daily" as const },
  { id: "365", label: "1Y", days: 365, interval: "daily" as const },
  { id: "max", label: "Max", days: 365, interval: "daily" as const },
];

export function PriceChart({
  symbol, kind, label, compact,
}: {
  symbol: string;
  kind: "stock" | "crypto";
  label: string;
  compact?: boolean;
}) {
  const [range, setRange] = useState(RANGES[2]);
  const [data, setData] = useState<{ t: number; close: number; vol?: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&kind=${kind}&days=${range.days}&interval=${range.interval}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.history?.length) {
          setData(d.history.map((p: { date: string; close: number; volume?: number }) => ({
            t: new Date(p.date).getTime(),
            close: p.close,
            vol: p.volume,
          })));
        } else setError(d.error ?? "no history");
      })
      .catch(() => alive && setError("fetch failed"));
    return () => { alive = false; };
  }, [symbol, kind, range]);

  const stats = useMemo(() => {
    if (!data?.length) return null;
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const min = Math.min(...data.map((d) => d.close));
    const max = Math.max(...data.map((d) => d.close));
    const pct = first ? ((last - first) / first) * 100 : 0;
    return { first, last, min, max, pct };
  }, [data]);

  if (error) return <p className="text-xs text-ink-dim">Chart unavailable: {error}</p>;
  if (!data || !stats) {
    return (
      <div className="flex items-center gap-2 py-8 text-xs text-ink-dim">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading chart…
      </div>
    );
  }

  const up = stats.pct >= 0;
  const stroke = up ? "#16a34a" : "#dc2626";
  const gradId = `cg-${symbol}-${range.id}`.replace(/[^a-z0-9-]/gi, "");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-panel p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                range.id === r.id ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-ink-dim">Low <span className="mono text-ink">${stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
          <span className="text-ink-dim">High <span className="mono text-ink">${stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
        </div>
      </div>
      <div className={`w-full ${compact ? "h-44" : "h-64"}`}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--t-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "var(--t-ink-dim)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "var(--t-line)" }}
              tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              minTickGap={48}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "var(--t-ink-dim)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) =>
                v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(v < 1 ? 4 : 2)}`
              }
            />
            <Tooltip
              contentStyle={{
                background: "var(--t-panel)",
                border: "1px solid var(--t-line)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--t-ink)",
              }}
              labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
              formatter={(v) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 6 })}`, "Price"]}
            />
            <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4, fill: stroke }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
