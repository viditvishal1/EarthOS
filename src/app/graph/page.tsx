"use client";

// Knowledge Graph Explorer — cross-module entity search, type filter,
// force-directed visualization, and per-entity neighborhood + source items.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, LoaderCircle, Network } from "lucide-react";
import type { GraphEdge, GraphEntity, Item } from "@/lib/types";
import { ForceGraph } from "@/components/ForceGraph";
import { ItemCard } from "@/components/ModuleView";
import { ReaderPane } from "@/components/ReaderPane";

const TYPES = ["all", "organization", "location", "event", "technology", "repository", "satellite", "vessel", "aircraft", "instrument"];

interface Snapshot {
  entities: GraphEntity[];
  edges: GraphEdge[];
  totals: { entities: number; edges: number };
}

interface Neighborhood {
  center: GraphEntity;
  entities: GraphEntity[];
  edges: GraphEdge[];
  items: Item[];
}

function GraphInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const entityParam = sp.get("entity");

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [hood, setHood] = useState<Neighborhood | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [reasonQ, setReasonQ] = useState("");
  const [reasoning, setReasoning] = useState<{ answer?: string; error?: string; busy?: boolean }>({});

  const runReason = async () => {
    setReasoning({ busy: true });
    try {
      const res = await fetch("/api/graph/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: entityParam ?? undefined, question: reasonQ || undefined }),
      });
      const d = await res.json();
      setReasoning(d.error ? { error: d.error } : { answer: d.answer });
    } catch {
      setReasoning({ error: "reasoning failed" });
    }
  };

  const loadSnapshot = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (type !== "all") p.set("type", type);
    fetch(`/api/graph?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error || !Array.isArray(d.entities) || !d.totals) {
          setSnap(null);
          setLoadError(typeof d.error === "string" ? d.error : "Failed to load graph");
          return;
        }
        setSnap(d);
      })
      .catch(() => {
        setSnap(null);
        setLoadError("Failed to load graph");
      })
      .finally(() => setLoading(false));
  }, [q, type]);

  useEffect(() => { if (!entityParam) loadSnapshot(); }, [entityParam, loadSnapshot]);

  useEffect(() => {
    if (!entityParam) { setHood(null); return; }
    setLoading(true);
    setSelectedItem(null);
    fetch(`/api/entity?id=${encodeURIComponent(entityParam)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error || !d.center) {
          setHood(null);
          setLoadError(typeof d.error === "string" ? d.error : "Entity not found");
          return;
        }
        setLoadError(null);
        setHood(d);
      })
      .catch(() => {
        setHood(null);
        setLoadError("Failed to load entity");
      })
      .finally(() => setLoading(false));
  }, [entityParam]);

  const openEntity = (id: string) => router.push(`/graph?entity=${encodeURIComponent(id)}`);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 flex items-center gap-2 text-lg font-semibold text-ink">
          <Network className="h-5 w-5 text-fuchsia-400" /> Knowledge Graph
          <span className="rounded-full border border-fuchsia-900/60 bg-fuchsia-950/40 px-2 py-0.5 text-[10px] font-normal text-fuchsia-300">Neuro-Symbolic AI</span>
        </h1>
        {hood ? (
          <button onClick={() => router.push("/graph")} className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-dim hover:text-ink">
            ← Back to full graph
          </button>
        ) : (
          <>
            <form onSubmit={(e) => { e.preventDefault(); loadSnapshot(); }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entities…"
                className="w-48 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none" />
            </form>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink-dim focus:outline-none">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </>
        )}
        {snap?.totals && !hood && (
          <span className="ml-auto text-[11px] text-ink-dim">
            {snap.totals.entities.toLocaleString()} entities · {snap.totals.edges.toLocaleString()} edges (top {snap.entities.length} shown)
          </span>
        )}
      </div>

      {loadError && !loading && (
        <div className="mb-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {loadError}
          {!hood && (
            <button onClick={loadSnapshot} className="ml-2 text-xs underline hover:text-amber-100">
              Retry
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-ink-dim">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Building graph from connector data…
        </div>
      )}

      {!loading && hood && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div>
            <div className="mb-2 rounded-lg border border-line bg-panel p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-dim">{hood.center.type}</div>
              <div className="text-lg font-semibold text-ink">{hood.center.name}</div>
              <div className="mt-0.5 text-xs text-ink-dim">
                degree {hood.center.degree ?? 0} · seen in: {(hood.center.modules ?? []).join(", ") || "—"} · first {hood.center.firstSeen ? new Date(hood.center.firstSeen).toLocaleDateString() : "—"}
              </div>
            </div>
            <ForceGraph entities={hood.entities} edges={hood.edges} onSelect={openEntity} height={420} />
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {selectedItem ? (
              <ReaderPane item={selectedItem} onClose={() => setSelectedItem(null)} />
            ) : (
              <>
                <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-dim">
                  Items referencing this entity ({hood.items.length})
                </h2>
                <div className="flex flex-col gap-1.5">
                  {hood.items.map((it) => (
                    <ItemCard key={it.id} item={it} selected={false} onSelect={() => setSelectedItem(it)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && !hood && snap?.entities && snap.totals && (
        <>
          <div className="mb-4 rounded-lg border border-line bg-panel p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink">
              <Bot className="h-4 w-4 text-fuchsia-400" /> Symbolic reasoning + neural synthesis
            </div>
            <p className="mb-2 text-[11px] text-ink-dim">
              Combines graph structure (entities, edges, co-occurrence) with retrieval-grounded Gemini analysis. Requires GEMINI_API_KEY.
            </p>
            <div className="flex gap-2">
              <input value={reasonQ} onChange={(e) => setReasonQ(e.target.value)}
                placeholder="Ask about patterns, connections, or risks across the graph…"
                className="min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none" />
              <button onClick={runReason} disabled={reasoning.busy}
                className="rounded-md border border-fuchsia-800 bg-fuchsia-950/50 px-3 py-1.5 text-xs text-fuchsia-200 hover:bg-fuchsia-900/40 disabled:opacity-50">
                {reasoning.busy ? "Thinking…" : "Reason"}
              </button>
            </div>
            {reasoning.answer && (
              <div className="prose-earthos mt-3 rounded-md border border-line bg-panel-2 p-3 text-sm text-soft">{reasoning.answer}</div>
            )}
            {reasoning.error && <p className="mt-2 text-xs text-amber-400">{reasoning.error}</p>}
          </div>
          <ForceGraph entities={snap.entities} edges={snap.edges} onSelect={openEntity} height={520} />
          <p className="mt-2 text-[11px] text-ink-dim">
            Node size = connection degree · colors = entity type · click any node to explore its neighborhood.
            Entities are extracted automatically from every module’s live feed.
          </p>
        </>
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-ink-dim">Loading…</div>}>
      <GraphInner />
    </Suspense>
  );
}
