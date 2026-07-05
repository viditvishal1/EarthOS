import { aiEnabled, listAiProviders, pingGemini } from "@/lib/ai";
import { noCacheJson } from "@/lib/http/no-cache";

export const dynamic = "force-dynamic";

/** AI provider chain health — Ollama, LM Studio, Gemini, extractive fallback. */
export async function GET() {
  const providers = listAiProviders();
  const generative = providers.filter((p) => p.id !== "extractive" && p.configured);

  let gemini: { ok: boolean; model?: string; latencyMs?: number; error?: string } = { ok: false };
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const r = await pingGemini();
      gemini = { ok: true, model: r.model, latencyMs: r.latencyMs };
    } catch (err) {
      gemini = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "failed" };
    }
  }

  return noCacheJson({
    configured: aiEnabled(),
    providers,
    gemini,
    fallback: "extractive",
    checkedAt: new Date().toISOString(),
  });
}
