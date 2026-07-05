// Supabase persistence layer — activated when SUPABASE_URL + a key are set.
// Accepts service role (server-only) or publishable/anon key (with RLS policies).

import type { CachedArticle } from "@/lib/article-cache";
import type { Item } from "@/lib/types";

/** Resolve Supabase API key — service role preferred; publishable/anon for prototype tier. */
export function supabaseKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function dbEnabled(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}

export function dbUsesPublishableKey(): boolean {
  return dbEnabled() && !process.env.SUPABASE_SERVICE_KEY;
}

type SupabaseClient = {
  from: (table: string) => {
    upsert: (row: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
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
  client = createClient(supabaseUrl()!, supabaseKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseClient;
  return client;
}

/** Ping Supabase — returns ok if URL + key work and tables exist. */
export async function checkSupabaseHealth(): Promise<{
  enabled: boolean;
  ok: boolean;
  mode?: "service" | "publishable";
  error?: string;
}> {
  if (!dbEnabled()) return { enabled: false, ok: false };
  try {
    const c = await sb();
    if (!c) return { enabled: false, ok: false };
    const { error } = await c.from("article_cache").select("id").eq("id", "__healthcheck__").maybeSingle();
    if (error?.message?.includes("does not exist") || error?.message?.includes("schema cache")) {
      return {
        enabled: true,
        ok: false,
        mode: dbUsesPublishableKey() ? "publishable" : "service",
        error: "Tables missing — run supabase/schema.sql in the Supabase SQL editor",
      };
    }
    return {
      enabled: true,
      ok: !error || error.message.includes("0 rows"),
      mode: dbUsesPublishableKey() ? "publishable" : "service",
      error: error && !error.message.includes("0 rows") ? error.message : undefined,
    };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      mode: dbUsesPublishableKey() ? "publishable" : "service",
      error: err instanceof Error ? err.message : "connection failed",
    };
  }
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
  const now = new Date().toISOString();
  const rows = items.map((it) => ({
    id: it.id,
    connector_id: connectorId,
    module: it.module,
    title: it.title,
    payload: it,
    ingested_at: now,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await c.from("ingested_items").upsert(rows.slice(i, i + 200));
  }
}

export async function logEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  const c = await sb();
  if (!c) return;
  await c.from("event_log").insert({ type, payload, created_at: new Date().toISOString() });
}
