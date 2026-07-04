// Supabase persistence layer — activated when SUPABASE_URL + SUPABASE_SERVICE_KEY
// are set. Falls back to no-op so the app runs at $0 without accounts.

import type { CachedArticle } from "@/lib/article-cache";
import type { Item } from "@/lib/types";

export function dbEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

type SupabaseClient = {
  from: (table: string) => {
    upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    select: (cols?: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

let client: SupabaseClient | null = null;

async function sb(): Promise<SupabaseClient | null> {
  if (!dbEnabled()) return null;
  if (client) return client;
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as SupabaseClient;
  return client;
}

export async function upsertArticleCache(key: string, data: CachedArticle): Promise<void> {
  const c = await sb();
  if (!c) return;
  await c.from("article_cache").upsert({
    id: key,
    url: data.url,
    title: data.title ?? null,
    paragraphs: data.paragraphs ?? null,
    pdf_url: data.pdfUrl ?? null,
    content_type: data.contentType,
    fetched_at: data.fetchedAt,
  });
}

export async function getArticleCache(key: string): Promise<CachedArticle | null> {
  const c = await sb();
  if (!c) return null;
  const { data, error } = await c.from("article_cache").select("*").eq("id", key).maybeSingle();
  if (error || !data) return null;
  return {
    url: String(data.url),
    title: data.title ? String(data.title) : undefined,
    paragraphs: Array.isArray(data.paragraphs) ? (data.paragraphs as string[]) : undefined,
    pdfUrl: data.pdf_url ? String(data.pdf_url) : undefined,
    contentType: (data.content_type as "html" | "pdf") ?? "html",
    fetchedAt: String(data.fetched_at),
  };
}

export async function persistIngestedItems(items: Item[], connectorId: string): Promise<void> {
  const c = await sb();
  if (!c || items.length === 0) return;
  for (const it of items.slice(0, 100)) {
    await c.from("ingested_items").upsert({
      id: it.id,
      connector_id: connectorId,
      module: it.module,
      title: it.title,
      payload: it,
      ingested_at: new Date().toISOString(),
    });
  }
}

export async function logEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  const c = await sb();
  if (!c) return;
  await c.from("event_log").insert({ type, payload, created_at: new Date().toISOString() });
}
