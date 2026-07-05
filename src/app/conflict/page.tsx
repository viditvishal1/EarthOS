"use client";

// Conflict & Crisis — geolocated armed-conflict, political-violence and
// humanitarian events (ReliefWeb keyless, UCDP keyless, ACLED key-gated)
// plotted on the shared map with the standard list + reader layout.

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { Item } from "@/lib/types";
import { MapView } from "@/components/MapView";
import { ItemCard, timeAgo } from "@/components/ModuleView";
import { ReaderPane } from "@/components/ReaderPane";

const TAG_FILTERS = ["all", "armed-conflict", "political-violence", "humanitarian"] as const;

export default function ConflictPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tag, setTag] = useState<(typeof TAG_FILTERS)[number]>("all");

  const load = useCallback(() => {
    fetch("/api/modules/conflict")
      .then((r) => r.json())
      .then((d) => {
        if (d.items) { setItems(d.items); setFetchedAt(d.fetchedAt); setError(null); }
        else setError(d.error ?? "load failed");
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 600_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(
    () => (items ?? []).filter((i) => tag === "all" || i.tags.includes(tag)),
    [items, tag],
  );
  const selected = filtered.find((i) => i.id === selectedId) ?? null;
  const mapped = filtered.filter((i) => typeof i.lat === "number");

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Conflict & Crisis</h1>
          <p className="text-xs text-ink-dim">
            ReliefWeb (keyless) · UCDP + ACLED with free keys · fatality estimates are provider figures, not Argus claims
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-dim">
          {fetchedAt && <span>fetched {timeAgo(fetchedAt)}</span>}
          <button onClick={load} className="rounded-md border border-line p-1.5 hover:text-ink" aria-label="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TAG_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors ${
              tag === t ? "border-red-600 bg-red-950/40 text-red-300" : "border-line text-ink-dim hover:text-ink"
            }`}
          >
            {t.replace(/-/g, " ")}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-ink-dim">
          {mapped.length} geolocated of {filtered.length} events
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {!items && !error ? (
        <div className="flex items-center gap-2 py-10 text-sm text-ink-dim">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Contacting connectors…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex flex-col gap-3">
            <MapView
              layers={[{ id: "conflict", color: "#ef4444", items: mapped, radius: 4 }]}
              onSelect={(id) => setSelectedId(id)}
              className="h-[44vh] w-full"
            />
            <div className="flex max-h-[32vh] flex-col gap-1.5 overflow-y-auto pr-1" role="feed">
              {filtered.map((it) => (
                <ItemCard key={it.id} item={it} selected={it.id === selectedId} onSelect={() => setSelectedId(it.id)} />
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-xs text-ink-dim">No events match the current filter.</div>
              )}
            </div>
          </div>
          <div className="max-h-[calc(100vh-14rem)]">
            {selected ? (
              <ReaderPane item={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-dim">
                Select an event on the map or in the list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
