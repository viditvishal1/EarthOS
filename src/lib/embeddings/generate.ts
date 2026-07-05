// pgvector embedding generation — Gemini text-embedding when configured.
//
// Default model is gemini-embedding-001 (text-embedding-004 was retired).
// Output dimensionality is pinned to the vector(768) column; vectors are
// re-normalized because truncated gemini-embedding-001 output is not unit-norm.

import { dbEnabled } from "@/lib/db";

/** Must match the vector(N) column in supabase migrations. */
export const EMBEDDING_DIM = 768;

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || text.length < 3) return null;

  try {
    const model = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const values = data.embedding?.values;
    if (!Array.isArray(values)) return null;
    if (values.length !== EMBEDDING_DIM) {
      console.error(
        `[embeddings] model returned ${values.length} dims, column expects ${EMBEDDING_DIM} — check GEMINI_EMBED_MODEL`,
      );
      return null;
    }
    return normalize(values);
  } catch {
    return null;
  }
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

export async function upsertEntityEmbedding(entityId: string, text: string): Promise<boolean> {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return false;
  const embedding = await generateEmbedding(text);
  if (!embedding) return false;

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const c = createClient(url!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  const { error } = await c.from("entity_embeddings").upsert({
    entity_id: entityId,
    embedding,
    model: process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
    updated_at: new Date().toISOString(),
  });
  return !error;
}
