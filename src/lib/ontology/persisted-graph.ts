// Persisted graph — load entities and relationships from Supabase ontology.

import { dbEnabled } from "@/lib/db";
import type { Item } from "@/lib/types";

export interface PersistedGraphNode {
  id: string;
  name: string;
  type: string;
  confidence: number;
}

export interface PersistedGraphEdge {
  source: string;
  target: string;
  type: string;
  confidence: number;
  resolution_method: string;
}

export async function loadPersistedGraph(opts?: {
  q?: string;
  type?: string;
  limit?: number;
}): Promise<{ entities: PersistedGraphNode[]; edges: PersistedGraphEdge[]; items: Item[] }> {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) {
    return { entities: [], edges: [], items: [] };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const c = createClient(url!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  const limit = opts?.limit ?? 120;
  let entityQuery = c.from("entities").select("id, canonical_name, object_type, confidence").order("last_seen", { ascending: false }).limit(limit);

  if (opts?.type) entityQuery = entityQuery.eq("object_type", opts.type);
  if (opts?.q) {
    const term = opts.q.replace(/[%_]/g, "").slice(0, 80);
    entityQuery = entityQuery.ilike("canonical_name", `%${term}%`);
  }

  const [{ data: entities }, { data: relationships }, { data: docs }] = await Promise.all([
    entityQuery,
    c.from("entity_relationships").select("source_entity_id, target_entity_id, relationship_type, confidence, resolution_method").order("created_at", { ascending: false }).limit(limit * 2),
    c.from("search_documents").select("id, module, title, summary, url, published_at, source_id").order("ingested_at", { ascending: false }).limit(Math.min(limit, 40)),
  ]);

  const nodes = (entities ?? []).map((e) => ({
    id: String(e.id),
    name: String(e.canonical_name),
    type: String(e.object_type),
    confidence: Number(e.confidence ?? 0.5),
  }));

  const edges = (relationships ?? []).map((r) => ({
    source: String(r.source_entity_id),
    target: String(r.target_entity_id),
    type: String(r.relationship_type),
    confidence: Number(r.confidence ?? 0.5),
    resolution_method: String(r.resolution_method ?? "inferred"),
  }));

  const items: Item[] = (docs ?? []).map((d) => ({
    id: String(d.id),
    module: String(d.module),
    connectorId: String(d.source_id ?? "search_index"),
    title: String(d.title),
    summary: d.summary ? String(d.summary) : undefined,
    url: d.url ? String(d.url) : undefined,
    source: "Argus Index",
    timestamp: d.published_at ? String(d.published_at) : new Date().toISOString(),
    tags: [],
    entities: [],
    contentPolicy: "metadata_only" as const,
  }));

  return { entities: nodes, edges, items };
}
