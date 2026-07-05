// AI layer — local-first provider chain (Ollama → LM Studio → Gemini → extractive fallback).

import type { Item } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/connectors/framework";
import { aiEnabled, generateWithProviderChain, listAiProviders } from "@/lib/ai/providers";

export { aiEnabled, listAiProviders };

function contextBlock(items: Item[]): string {
  return items
    .map(
      (it, i) =>
        `[${i + 1}] (${it.module}/${it.source}, ${it.timestamp.slice(0, 16)}${it.severityLabel ? `, severity: ${it.severityLabel}` : ""}) ${it.title}` +
        (it.summary ? ` — ${it.summary.slice(0, 220)}` : ""),
    )
    .join("\n");
}

const ANALYST_SYSTEM = `You are the Argus AI Analyst. Answer using ONLY the numbered source items provided. Rules:
- Cite sources inline as [n] after every factual claim.
- If sources are insufficient, say so — never invent facts.
- Prefix speculation with "AI hypothesis (not a verified forecast):".
- Be concise.`;

const BRIEFING_SYSTEM = `Write a tight situational briefing (max 180 words) from the items. Cite as [n]. No preamble.`;

export async function askAnalyst(
  question: string,
  items: Item[],
): Promise<{ answer: string; sources: Item[]; provider: string; model: string }> {
  const sources = items.slice(0, 40);
  const result = await generateWithProviderChain(
    ANALYST_SYSTEM,
    `Source items:\n${contextBlock(sources)}\n\nQuestion: ${question}`,
  );
  return {
    answer: result.text,
    sources,
    provider: result.provider,
    model: result.model,
  };
}

export async function writeBriefing(items: Item[]): Promise<{ text: string; provider: string; model: string }> {
  const result = await generateWithProviderChain(
    BRIEFING_SYSTEM,
    `Items:\n${contextBlock(items.slice(0, 35))}`,
  );
  return { text: result.text, provider: result.provider, model: result.model };
}

export async function pingGemini(): Promise<{ model: string; latencyMs: number }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const started = Date.now();
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      timeoutMs: 15_000,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }
  return { model, latencyMs: Date.now() - started };
}
