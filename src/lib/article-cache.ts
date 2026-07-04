// Persistent article cache — in-process by default; mirrors to Supabase when
// configured so extracted text survives serverless cold starts.

import { createHash } from "crypto";
import { dbEnabled, upsertArticleCache, getArticleCache } from "@/lib/db";

export interface CachedArticle {
  url: string;
  title?: string;
  paragraphs?: string[];
  pdfUrl?: string;
  contentType: "html" | "pdf";
  fetchedAt: string;
}

type MemEntry = { at: number; data: CachedArticle };

const TTL_MS = 7 * 24 * 3600_000; // 7 days
const g = globalThis as unknown as { __articleCache?: Map<string, MemEntry> };
const mem = (g.__articleCache ??= new Map());

export function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export async function readArticleCache(url: string): Promise<CachedArticle | null> {
  const key = cacheKey(url);
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  if (dbEnabled()) {
    const row = await getArticleCache(key);
    if (row) {
      mem.set(key, { at: Date.now(), data: row });
      return row;
    }
  }
  return null;
}

export async function writeArticleCache(data: CachedArticle): Promise<void> {
  const key = cacheKey(data.url);
  mem.set(key, { at: Date.now(), data });
  if (dbEnabled()) {
    await upsertArticleCache(key, data);
  }
}
