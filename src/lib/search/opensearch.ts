// OpenSearch adapter — production index with PostgreSQL FTS fallback.

import { isFeatureEnabled } from "@/lib/platform/feature-flags";
import { dbEnabled } from "@/lib/db";
import type { Item } from "@/lib/types";

export interface SearchHit {
  id: string;
  module: string;
  title: string;
  summary?: string;
  url?: string;
  score: number;
  source: "opensearch" | "postgres" | "connector";
  timestamp?: string;
}

async function serviceClient() {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

function openSearchAuthHeaders(): Record<string, string> {
  const user = process.env.OPENSEARCH_USERNAME;
  const pass = process.env.OPENSEARCH_PASSWORD;
  const auth = user && pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` : undefined;
  return auth ? { Authorization: auth } : {};
}

/** Index or update a single document in OpenSearch (ingest pipeline). */
export async function indexItemToOpenSearch(item: Item): Promise<boolean> {
  const base = process.env.OPENSEARCH_URL;
  if (!base) return false;

  const doc = {
    module: item.module,
    title: item.title,
    summary: item.summary ?? "",
    body: item.body?.slice(0, 8000) ?? "",
    url: item.url ?? "",
    published_at: item.timestamp,
    ingested_at: new Date().toISOString(),
    tags: item.tags,
    source_id: item.connectorId,
  };

  const res = await fetch(
    `${base.replace(/\/$/, "")}/earthos/_doc/${encodeURIComponent(item.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...openSearchAuthHeaders() },
      body: JSON.stringify(doc),
    },
  );
  return res.ok;
}

async function searchOpenSearch(q: string, limit: number): Promise<SearchHit[]> {
  const base = process.env.OPENSEARCH_URL;
  if (!base) return [];

  const res = await fetch(`${base.replace(/\/$/, "")}/earthos/_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...openSearchAuthHeaders() },
    body: JSON.stringify({
      size: limit,
      query: { multi_match: { query: q, fields: ["title^3", "summary^2", "body"] } },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.hits?.hits ?? []).map((h: { _id: string; _score: number; _source: Record<string, string> }) => ({
    id: h._id,
    module: h._source.module ?? "unknown",
    title: h._source.title ?? "",
    summary: h._source.summary,
    url: h._source.url,
    score: h._score,
    source: "opensearch" as const,
    timestamp: h._source.published_at,
  }));
}

async function searchPostgres(q: string, limit: number): Promise<SearchHit[]> {
  const c = await serviceClient();
  if (!c) return [];

  let rpcRows: Record<string, unknown>[] | null = null;
  try {
    const { data, error } = await c.rpc("search_documents_fts", { query_text: q, result_limit: limit });
    if (!error && data) rpcRows = data as Record<string, unknown>[];
  } catch { /* RPC may not exist */ }

  if (rpcRows) {
    return rpcRows.map((row) => ({
      id: String(row.id),
      module: String(row.module),
      title: String(row.title),
      summary: row.summary ? String(row.summary) : undefined,
      url: row.url ? String(row.url) : undefined,
      score: Number(row.rank ?? 1),
      source: "postgres" as const,
      timestamp: row.published_at ? String(row.published_at) : undefined,
    }));
  }

  // Fallback: ilike search if RPC not created
  const { data: rows } = await c
    .from("search_documents")
    .select("id, module, title, summary, url, published_at")
    .or(`title.ilike.%${q.replace(/[%_]/g, "")}%,summary.ilike.%${q.replace(/[%_]/g, "")}%`)
    .order("ingested_at", { ascending: false })
    .limit(limit);

  return (rows ?? []).map((row: Record<string, unknown>, i: number) => ({
    id: String(row.id),
    module: String(row.module),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : undefined,
    url: row.url ? String(row.url) : undefined,
    score: limit - i,
    source: "postgres" as const,
    timestamp: row.published_at ? String(row.published_at) : undefined,
  }));
}

export async function indexedSearch(q: string, limit = 40): Promise<SearchHit[]> {
  if (await isFeatureEnabled("opensearch")) {
    const os = await searchOpenSearch(q, limit);
    if (os.length > 0) return os;
  }
  return searchPostgres(q, limit);
}

export function hitsToItems(hits: SearchHit[]): Item[] {
  return hits.map((h) => ({
    id: h.id,
    module: h.module,
    connectorId: "search_index",
    title: h.title,
    summary: h.summary,
    url: h.url,
    source: h.source === "opensearch" ? "OpenSearch" : "Argus Index",
    timestamp: h.timestamp ?? new Date().toISOString(),
    tags: [],
    entities: [],
    contentPolicy: "metadata_only" as const,
    extra: { searchScore: h.score, searchSource: h.source },
  }));
}
