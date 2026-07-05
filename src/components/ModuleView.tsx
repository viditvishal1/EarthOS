"use client";

// Shared module layout contract (PRD §15): Filter bar (top) → Feed/List →
// Reader pane (right) → Linked entities (inside reader). Every list module
// is this one component with a different connector feed behind it.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { Item } from "@/lib/types";
import { applyFilters, FilterBar, readFilters } from "@/components/FilterBar";
import { ReaderPane } from "@/components/ReaderPane";

export function ItemCard({
  item, selected, onSelect, highlight,
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
  highlight?: boolean;
}) {
  const sev = item.severity ?? 0;
  const sevColor =
    sev >= 8 ? "bg-red-500" : sev >= 6 ? "bg-orange-500" : sev >= 4 ? "bg-amber-500" : "bg-zinc-600";
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
        selected ? "border-accent/60 bg-panel-2" : "border-line bg-panel hover:bg-panel-2"
      } ${highlight ? "ring-1 ring-red-500/50" : ""}`}
    >
      <div className="mb-0.5 flex items-center gap-2 text-[11px] text-ink-dim">
        {item.severityLabel && (
          <span className="flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${sevColor}`} />
            <span className="mono">{item.severityLabel}</span>
          </span>
        )}
        <span className="truncate">{item.source}</span>
        <span className="ml-auto shrink-0">{timeAgo(item.timestamp)}</span>
      </div>
      <div className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.title}</div>
      {item.summary && item.summary !== item.title && (
        <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-dim">{item.summary}</div>
      )}
    </button>
  );
}

export function timeAgo(ts: string): string {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (Number.isNaN(s)) return "";
  if (s < 0) return `in ${Math.round(-s / 3600)}h`;
  if (s < 90) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function ModuleViewInner({
  module, title, subtitle, extraHeader, highlightFn, refreshSeconds,
}: {
  module: string;
  title: string;
  subtitle?: string;
  extraHeader?: React.ReactNode;
  highlightFn?: (item: Item) => boolean;
  refreshSeconds?: number;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sp = useSearchParams();

  const load = useCallback(() => {
    fetch(`/api/modules/${module}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.items) { setItems(d.items); setFetchedAt(d.fetchedAt); setError(null); }
        else setError(d.error ?? "load failed");
      })
      .catch((e) => setError(String(e)));
  }, [module]);

  useEffect(() => {
    load();
    if (refreshSeconds) {
      const t = setInterval(load, refreshSeconds * 1000);
      return () => clearInterval(t);
    }
  }, [load, refreshSeconds]);

  const filters = readFilters(new URLSearchParams(sp.toString()));
  const filtered = useMemo(() => (items ? applyFilters(items, filters) : []), [items, filters]);
  const selected = filtered.find((i) => i.id === selectedId) ?? items?.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-dim">
          {fetchedAt && <span>fetched {timeAgo(fetchedAt)}</span>}
          <button onClick={load} className="rounded-md border border-line p-1.5 hover:text-ink" aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {extraHeader}
      {items && <FilterBar items={items} module={module} />}

      {error && (
        <div className="mb-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {!items && !error ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ink-dim">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Contacting connectors…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex max-h-[calc(100vh-15rem)] flex-col gap-1.5 overflow-y-auto pr-1" role="feed">
            <div className="text-[11px] text-ink-dim">{filtered.length} items</div>
            {filtered.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                selected={it.id === selectedId}
                onSelect={() => setSelectedId(it.id)}
                highlight={highlightFn?.(it)}
              />
            ))}
            {filtered.length === 0 && items && (
              <div className="py-8 text-center text-xs text-ink-dim">
                No items match the current filters.
              </div>
            )}
          </div>
          <div className="hidden max-h-[calc(100vh-15rem)] lg:block">
            {selected ? (
              <ReaderPane item={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-dim">
                Select an item to read it here — without leaving Argus.
              </div>
            )}
          </div>
          {selected && (
            <div className="fixed inset-0 z-50 bg-black/60 p-4 lg:hidden" onClick={() => setSelectedId(null)}>
              <div className="mx-auto h-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
                <ReaderPane item={selected} onClose={() => setSelectedId(null)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ModuleView(props: Parameters<typeof ModuleViewInner>[0]) {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-ink-dim">Loading…</div>}>
      <ModuleViewInner {...props} />
    </Suspense>
  );
}
