// Citation-grounded research — Perplexity-style with verifiable sources.

import { hybridSearch } from "@/lib/search/hybrid";
import { aiEnabled } from "@/lib/ai";
import type { Item } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/connectors/framework";

export interface ResearchCitation {
  index: number;
  title: string;
  publisher: string;
  url?: string;
  observedAt: string;
  fetchedAt: string;
  reliability: "high" | "medium" | "low";
}

export interface ResearchResponse {
  query: string;
  answer: string | null;
  citations: ResearchCitation[];
  confidence: "high" | "medium" | "low" | "insufficient";
  contradictions?: string[];
  inferenceLabel: string;
  error?: string;
}

const RESEARCH_SYSTEM = `You are Argus Research. Answer ONLY from the numbered sources provided.
- Cite every factual claim as [n].
- If sources conflict, state both views and mark uncertainty.
- Prefix any inference beyond sources with "Inference:".
- Never fabricate citations or URLs.
- If sources are insufficient, say so.`;

async function geminiResearch(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      timeoutMs: 45000,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RESEARCH_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

function buildCitations(items: Item[]): ResearchCitation[] {
  return items.map((it, i) => ({
    index: i + 1,
    title: it.title,
    publisher: it.source,
    url: it.url,
    observedAt: it.timestamp,
    fetchedAt: new Date().toISOString(),
    reliability: it.module === "government" || it.module === "cyber" ? "high" : "medium",
  }));
}

export async function groundedResearch(q: string): Promise<ResearchResponse> {
  const { items } = await hybridSearch(q, { limit: 30 });
  const citations = buildCitations(items);

  if (items.length === 0) {
    return {
      query: q,
      answer: null,
      citations: [],
      confidence: "insufficient",
      inferenceLabel: "No indexed or live sources matched this query.",
      error: "No sources found",
    };
  }

  if (!aiEnabled()) {
    return {
      query: q,
      answer: items.slice(0, 8).map((it, i) => `[${i + 1}] ${it.title}${it.summary ? ` — ${it.summary.slice(0, 120)}` : ""}`).join("\n"),
      citations,
      confidence: "medium",
      inferenceLabel: "Retrieval-only mode (set GEMINI_API_KEY for synthesized answers).",
    };
  }

  const context = items
    .map((it, i) => `[${i + 1}] (${it.source}, ${it.timestamp.slice(0, 16)}) ${it.title}${it.summary ? ` — ${it.summary.slice(0, 200)}` : ""}`)
    .join("\n");

  const answer = await geminiResearch(`Sources:\n${context}\n\nQuestion: ${q}`);
  const confidence = items.length >= 8 ? "high" : items.length >= 3 ? "medium" : "low";

  return {
    query: q,
    answer,
    citations,
    confidence,
    inferenceLabel: "AI synthesis grounded in retrieved sources — verify citations.",
  };
}
