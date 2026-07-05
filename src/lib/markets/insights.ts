import type { Item } from "@/lib/types";
import { aiEnabled } from "@/lib/ai";
import { fetchWithTimeout } from "@/lib/connectors/framework";
import { createHash } from "crypto";

export interface MarketInsight {
  outlook: "bullish" | "bearish" | "neutral" | "uncertain";
  confidence: number;
  horizon: string;
  risks: string[];
  catalysts: string[];
  narrative: string;
  aiEnabled: boolean;
  disclaimer: string;
}

const INSIGHT_CACHE = new Map<string, { at: number; insight: MarketInsight }>();
const CACHE_TTL_MS = 20 * 60 * 1000;

const INSIGHT_SYSTEM = `You are a neuro-symbolic market analyst for Argus. Given price context and news headlines, produce a structured JSON object ONLY (no markdown fences):
{
  "outlook": "bullish" | "bearish" | "neutral" | "uncertain",
  "confidence": 0.0-1.0,
  "horizon": "1-4 weeks",
  "risks": ["short risk flag", ...],
  "catalysts": ["short catalyst", ...],
  "narrative": "2-3 sentence grounded outlook citing news themes"
}
Rules:
- Base reasoning on provided news and price data only.
- Prefix speculative claims in narrative with "AI hypothesis:".
- risks and catalysts: max 4 items each, under 80 chars.
- Never claim certainty; confidence reflects evidence quality.`;

async function geminiJson(prompt: string): Promise<Record<string, unknown>> {
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
        systemInstruction: { parts: [{ text: INSIGHT_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 800, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return JSON.parse(text) as Record<string, unknown>;
}

function fallbackInsight(name: string, changePct: number, news: Item[]): MarketInsight {
  const tone = changePct > 1 ? "bullish" : changePct < -1 ? "bearish" : "neutral";
  const headlines = news.slice(0, 3).map((n) => n.title).join("; ");
  return {
    outlook: tone,
    confidence: 0.35,
    horizon: "1-2 weeks",
    risks: ["Limited AI — add GEMINI_API_KEY for deeper analysis"],
    catalysts: headlines ? [headlines.slice(0, 120)] : ["No recent headlines in Argus cache"],
    narrative: headlines
      ? `${name} is ${tone} on recent price action (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% day). Related headlines: ${headlines.slice(0, 200)}.`
      : `${name}: price ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% day. Set GEMINI_API_KEY for AI outlook.`,
    aiEnabled: false,
    disclaimer: "Rule-based summary — not investment advice",
  };
}

export async function generateMarketInsight(input: {
  symbol: string;
  name: string;
  kind: "crypto" | "stock" | "index";
  price?: number;
  changePct?: number;
  news: Item[];
}): Promise<MarketInsight> {
  const cacheKey = createHash("sha256")
    .update(`${input.symbol}:${input.news.map((n) => n.id).join(",")}`)
    .digest("hex");
  const hit = INSIGHT_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.insight;

  const changePct = input.changePct ?? 0;
  if (!aiEnabled()) {
    const insight = fallbackInsight(input.name, changePct, input.news);
    INSIGHT_CACHE.set(cacheKey, { at: Date.now(), insight });
    return insight;
  }

  const newsBlock = input.news
    .slice(0, 8)
    .map((n, i) => `[${i + 1}] ${n.title}${n.summary ? ` — ${n.summary.slice(0, 120)}` : ""}`)
    .join("\n");

  const prompt = `Instrument: ${input.name} (${input.symbol}), type: ${input.kind}
Price: ${input.price ?? "unknown"}, day change: ${changePct}%
News:\n${newsBlock || "(none)"}`;

  try {
    const raw = await geminiJson(prompt);
    const outlook = String(raw.outlook ?? "uncertain") as MarketInsight["outlook"];
    const insight: MarketInsight = {
      outlook: ["bullish", "bearish", "neutral", "uncertain"].includes(outlook) ? outlook : "uncertain",
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
      horizon: String(raw.horizon ?? "1-4 weeks"),
      risks: Array.isArray(raw.risks) ? raw.risks.map(String).slice(0, 4) : [],
      catalysts: Array.isArray(raw.catalysts) ? raw.catalysts.map(String).slice(0, 4) : [],
      narrative: String(raw.narrative ?? ""),
      aiEnabled: true,
      disclaimer: "AI-generated outlook — not investment advice",
    };
    INSIGHT_CACHE.set(cacheKey, { at: Date.now(), insight });
    return insight;
  } catch {
    const insight = fallbackInsight(input.name, changePct, input.news);
    INSIGHT_CACHE.set(cacheKey, { at: Date.now(), insight });
    return insight;
  }
}
