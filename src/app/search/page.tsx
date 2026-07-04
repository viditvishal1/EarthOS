"use client";

// Global Search results — grouped by module with an AI briefing on top
// (PRD §17.1, Flow A). Every result opens in the in-app reader.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { Item } from "@/lib/types";
import { moduleById } from "@/lib/modules";
import { ItemCard } from "@/components/ModuleView";
import { ReaderPane } from "@/components/ReaderPane";

interface SearchResponse {
  grouped: Record<string, Item[]>;
  total: number;
  aiEnabled?: boolean;
  fetchedAt: string;
}

function SearchInner() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  useEffect(() => {
    if (!q) return;
    let alive = true;
    setLoading(true);
    setRes(null);
    setBriefing(null);
    setBriefingError(null);
    setSelected(null);
    // Results first — never blocked on the AI call.
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: SearchResponse) => {
        if (!alive) return;
        setRes(d);
        setLoading(false);
        if (d.total > 0 && d.aiEnabled) {
          setBriefingLoading(true);
          fetch(`/api/search?q=${encodeURIComponent(q)}&mode=briefing`)
            .then((r) => r.json())
            .then((b) => {
              if (!alive) return;
              setBriefing(b.briefing);
              setBriefingError(b.briefingError);
            })
            .finally(() => alive && setBriefingLoading(false));
        }
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [q]);

  if (!q) return <p className="text-sm text-ink-dim">Type a query in the search bar above.</p>;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-3 text-lg font-semibold text-ink">
        Results for “{q}” {res && <span className="text-sm font-normal text-ink-dim">· {res.total} items</span>}
      </h1>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-ink-dim">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Searching all modules…
        </div>
      )}

      {briefingLoading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-violet-900/60 bg-violet-950/20 p-3 text-xs text-violet-300">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Generating AI briefing from the results…
        </div>
      )}
      {briefing && (
        <div className="mb-4 rounded-lg border border-violet-900/60 bg-violet-950/20 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" /> AI briefing — generated from the sources below
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">{briefing}</p>
        </div>
      )}
      {briefingError && (
        <div className="mb-4 rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-dim">
          AI briefing unavailable: {briefingError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {res && Object.entries(res.grouped).map(([mod, items]) => (
            <section key={mod}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-dim">
                {moduleById(mod)?.name ?? mod} <span className="font-normal">({items.length})</span>
              </h2>
              <div className="flex flex-col gap-1.5">
                {items.map((it) => (
                  <ItemCard key={it.id} item={it} selected={selected?.id === it.id} onSelect={() => setSelected(it)} />
                ))}
              </div>
            </section>
          ))}
          {res && res.total === 0 && <p className="py-6 text-sm text-ink-dim">Nothing matched across the connector caches.</p>}
        </div>
        <div className="max-h-[70vh]">
          {selected ? (
            <ReaderPane item={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-dim">
              Select a result to read it in-app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-ink-dim">Loading…</div>}>
      <SearchInner />
    </Suspense>
  );
}
