import { createHash } from "crypto";
import { fetchWithTimeout } from "@/lib/connectors/framework";

export type AiProviderId = "ollama" | "lmstudio" | "gemini" | "extractive";

export interface AiProviderResult {
  text: string;
  provider: AiProviderId;
  model: string;
  cached: boolean;
}

type AiCache = Map<string, { at: number; text: string; provider: AiProviderId; model: string }>;
const g = globalThis as unknown as { __argusAi?: AiCache };
const cache: AiCache = (g.__argusAi ??= new Map());
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(system: string, prompt: string): string {
  return createHash("sha256").update(system + "\0" + prompt).digest("hex");
}

function extractiveSummary(prompt: string, system: string): string {
  const lines = prompt.split("\n").filter((l) => /^\[\d+\]/.test(l.trim()));
  if (!lines.length) {
    return "Insufficient source material to answer. Configure Ollama/LM Studio or GEMINI_API_KEY for synthesis, or broaden your search.";
  }
  const top = lines.slice(0, 6);
  return [
    `**Retrieval-only summary** (no generative model configured — ${system.includes("Analyst") ? "analyst" : "briefing"} mode)`,
    "",
    ...top.map((l) => `- ${l.trim()}`),
    "",
    lines.length > 6 ? `_+${lines.length - 6} additional sources omitted._` : "",
  ].filter(Boolean).join("\n");
}

async function openAiCompatibleChat(
  baseUrl: string,
  model: string,
  system: string,
  prompt: string,
  provider: AiProviderId,
): Promise<string> {
  const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    timeoutMs: 60_000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${provider} returned empty response`);
  return text;
}

async function geminiChat(system: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      timeoutMs: 45_000,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

export function listAiProviders(): { id: AiProviderId; configured: boolean; label: string }[] {
  const ollama = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const lm = process.env.LMSTUDIO_BASE_URL?.trim();
  return [
    { id: "ollama", configured: Boolean(ollama), label: `Ollama (${process.env.OLLAMA_MODEL || "llama3.2"})` },
    { id: "lmstudio", configured: Boolean(lm), label: `LM Studio (${process.env.LMSTUDIO_MODEL || "local"})` },
    { id: "gemini", configured: Boolean(process.env.GEMINI_API_KEY?.trim()), label: process.env.GEMINI_MODEL || "gemini-2.5-flash" },
    { id: "extractive", configured: true, label: "Retrieval-only (no API key)" },
  ];
}

export async function generateWithProviderChain(
  system: string,
  prompt: string,
): Promise<AiProviderResult> {
  const hash = cacheKey(system, prompt);
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { text: hit.text, provider: hit.provider, model: hit.model, cached: true };
  }

  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim() || (process.env.OLLAMA_HOST ? `http://${process.env.OLLAMA_HOST}` : "");
  const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
  const lmUrl = process.env.LMSTUDIO_BASE_URL?.trim();
  const lmModel = process.env.LMSTUDIO_MODEL || "local-model";

  const chain: { id: AiProviderId; model: string; run: () => Promise<string> }[] = [];

  if (ollamaUrl) {
    chain.push({
      id: "ollama",
      model: ollamaModel,
      run: () => openAiCompatibleChat(ollamaUrl, ollamaModel, system, prompt, "ollama"),
    });
  }
  if (lmUrl) {
    chain.push({
      id: "lmstudio",
      model: lmModel,
      run: () => openAiCompatibleChat(lmUrl, lmModel, system, prompt, "lmstudio"),
    });
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    chain.push({
      id: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      run: () => geminiChat(system, prompt),
    });
  }

  for (const step of chain) {
    try {
      const text = await step.run();
      cache.set(hash, { at: Date.now(), text, provider: step.id, model: step.model });
      return { text, provider: step.id, model: step.model, cached: false };
    } catch {
      continue;
    }
  }

  const text = extractiveSummary(prompt, system);
  cache.set(hash, { at: Date.now(), text, provider: "extractive", model: "retrieval-v1" });
  return { text, provider: "extractive", model: "retrieval-v1", cached: false };
}

export function aiEnabled(): boolean {
  return listAiProviders().some((p) => p.configured && p.id !== "extractive");
}
