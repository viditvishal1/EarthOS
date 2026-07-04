"use client";

// Universal Filter Bar (PRD §8) — the same component for every list, feed and
// map layer. Filter state is encoded in the URL query string so every
// filtered view is shareable/bookmarkable. AND across dimensions, OR within
// a multi-select dimension.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Save } from "lucide-react";
import type { Item } from "@/lib/types";
import { deletePreset, getPresets, savePreset, type FilterPreset } from "@/lib/saved";

export interface FilterState {
  q: string;
  sources: string[];
  tags: string[];
  regions: string[];
  minSeverity: number;
  rangeHours: number; // 0 = all time
}

export function readFilters(sp: URLSearchParams): FilterState {
  return {
    q: sp.get("fq") ?? "",
    sources: sp.get("fsrc")?.split("|").filter(Boolean) ?? [],
    tags: sp.get("ftag")?.split("|").filter(Boolean) ?? [],
    regions: sp.get("freg")?.split("|").filter(Boolean) ?? [],
    minSeverity: parseFloat(sp.get("fsev") ?? "0") || 0,
    rangeHours: parseInt(sp.get("frange") ?? "0", 10) || 0,
  };
}

export function applyFilters(items: Item[], f: FilterState): Item[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const cutoff = f.rangeHours > 0 ? Date.now() - f.rangeHours * 3600_000 : 0;
  return items.filter((it) => {
    if (f.sources.length && !f.sources.includes(it.source)) return false;
    if (f.tags.length && !f.tags.some((t) => it.tags.includes(t))) return false;
    if (f.regions.length && !f.regions.includes(it.region ?? "")) return false;
    if (f.minSeverity > 0 && (it.severity ?? 0) < f.minSeverity) return false;
    if (cutoff && new Date(it.timestamp).getTime() < cutoff) return false;
    if (terms.length) {
      const hay = `${it.title} ${it.summary ?? ""} ${it.source} ${it.tags.join(" ")} ${it.entities.map((e) => e.name).join(" ")}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const RANGES: { label: string; hours: number }[] = [
  { label: "All time", hours: 0 },
  { label: "Last hour", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">{selected.length}</span>
        )}
        <ChevronDown className="h-3 w-3" />
      </summary>
      <div className="absolute left-0 top-full z-40 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-line bg-panel-2 p-2 shadow-xl">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-ink hover:bg-panel">
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o))
              }
              className="accent-[#4cc2ff]"
            />
            <span className="truncate">{o}</span>
          </label>
        ))}
        {options.length === 0 && <div className="px-1.5 py-1 text-xs text-ink-dim">No options</div>}
      </div>
    </details>
  );
}

export function FilterBar({ items, module }: { items: Item[]; module: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = readFilters(new URLSearchParams(sp.toString()));
  const [presets, setPresets] = useState<FilterPreset[]>(() => getPresets(module));

  const set = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...filters, ...patch };
      const p = new URLSearchParams(sp.toString());
      const setOrDel = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
      setOrDel("fq", next.q);
      setOrDel("fsrc", next.sources.join("|"));
      setOrDel("ftag", next.tags.join("|"));
      setOrDel("freg", next.regions.join("|"));
      setOrDel("fsev", next.minSeverity ? String(next.minSeverity) : "");
      setOrDel("frange", next.rangeHours ? String(next.rangeHours) : "");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [filters, pathname, router, sp],
  );

  const sources = useMemo(() => [...new Set(items.map((i) => i.source))].sort(), [items]);
  const tags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);
  const regions = useMemo(
    () => [...new Set(items.map((i) => i.region).filter((r): r is string => Boolean(r)))].sort(),
    [items],
  );
  const active =
    filters.q || filters.sources.length || filters.tags.length || filters.regions.length ||
    filters.minSeverity || filters.rangeHours;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <input
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Filter…"
        aria-label="Filter text"
        className="w-40 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
      />
      <select
        value={filters.rangeHours}
        onChange={(e) => set({ rangeHours: parseInt(e.target.value, 10) })}
        aria-label="Date range"
        className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink-dim focus:outline-none"
      >
        {RANGES.map((r) => (
          <option key={r.hours} value={r.hours}>{r.label}</option>
        ))}
      </select>
      <MultiSelect label="Source" options={sources} selected={filters.sources} onChange={(v) => set({ sources: v })} />
      <MultiSelect label="Tags" options={tags} selected={filters.tags} onChange={(v) => set({ tags: v })} />
      {regions.length > 1 && (
        <MultiSelect label="Region" options={regions} selected={filters.regions} onChange={(v) => set({ regions: v })} />
      )}
      <label className="flex items-center gap-1.5 text-xs text-ink-dim">
        Min severity
        <input
          type="range" min={0} max={10} step={1}
          value={filters.minSeverity}
          onChange={(e) => set({ minSeverity: parseFloat(e.target.value) })}
          className="w-20 accent-[#4cc2ff]"
        />
        <span className="mono w-4 text-ink">{filters.minSeverity || "–"}</span>
      </label>

      {active ? (
        <button
          onClick={() => set({ q: "", sources: [], tags: [], regions: [], minSeverity: 0, rangeHours: 0 })}
          className="flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs text-ink-dim hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      ) : null}

      <details className="relative ml-auto">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink [&::-webkit-details-marker]:hidden">
          <Save className="h-3 w-3" /> Views {presets.length > 0 && `(${presets.length})`}
        </summary>
        <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-line bg-panel-2 p-2 shadow-xl">
          <button
            onClick={() => {
              const name = window.prompt("Name this view (e.g. 'Critical only')");
              if (!name) return;
              savePreset(module, { name, params: sp.toString() });
              setPresets(getPresets(module));
            }}
            className="mb-1 w-full rounded bg-panel px-2 py-1 text-left text-xs text-accent hover:bg-panel"
          >
            + Save current filters as view
          </button>
          {presets.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-panel">
              <button className="truncate text-left text-ink" onClick={() => router.replace(`${pathname}?${p.params}`)}>
                {p.name}
              </button>
              <button
                className="text-ink-dim hover:text-red-400"
                onClick={() => { deletePreset(module, p.name); setPresets(getPresets(module)); }}
                aria-label={`Delete view ${p.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
