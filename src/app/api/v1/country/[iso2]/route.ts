import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { computeCiiV1 } from "@/lib/intelligence/cii/v1";
import { findingsForCountry } from "@/lib/intelligence/findings";
import { getCountry } from "@/lib/geo/country-index";
import { readModuleLiveCached } from "@/lib/live/module-cache";
import { aiEnabled, writeBriefing } from "@/lib/ai";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function loadItems(): Promise<Item[]> {
  const mods = await Promise.all(
    ["earth", "news", "conflict", "cyber", "government"].map((m) => readModuleLiveCached(m)),
  );
  return mods.flatMap((r) => r?.data ?? []);
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ iso2: string }> },
) {
  const { iso2 } = await ctx.params;
  const country = getCountry(iso2);
  if (!country) {
    return noCacheJson({ error: "unknown country", iso2 }, { status: 404 });
  }

  const items = await loadItems();
  const cii = computeCiiV1(iso2, items);
  const findings = findingsForCountry(items, iso2);
  const briefItems = cii.topItems.slice(0, 20);

  const includeBrief = req.nextUrl.searchParams.get("brief") !== "0";
  let brief: { text: string; provider: string; model: string } | null = null;
  if (includeBrief && briefItems.length > 0) {
    try {
      brief = await writeBriefing(briefItems);
    } catch {
      brief = {
        text: "Briefing unavailable — configure Ollama, LM Studio, or GEMINI_API_KEY.",
        provider: "none",
        model: "none",
      };
    }
  }

  return noCacheJson({
    iso2: country.iso2,
    country: country.name,
    region: country.region,
    cii,
    findings,
    timeline: briefItems,
    brief,
    aiConfigured: aiEnabled(),
    exportedAt: new Date().toISOString(),
    disclaimer: "CII v1 is an editorial model from available public feeds — not a verified forecast.",
  });
}
