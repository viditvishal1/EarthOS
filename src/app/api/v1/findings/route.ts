import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { detectFindings, computeStrategicRisk } from "@/lib/intelligence/findings";
import { readModuleLiveCached } from "@/lib/live/module-cache";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadItems(): Promise<Item[]> {
  const mods = await Promise.all(
    ["earth", "news", "conflict", "cyber", "aviation", "maritime"].map((m) => readModuleLiveCached(m)),
  );
  return mods.flatMap((r) => r?.data ?? []);
}

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20);
  const items = await loadItems();
  const findings = detectFindings(items, { limit });
  const strategicRisk = computeStrategicRisk(items, 5);
  return noCacheJson({
    findings,
    count: findings.length,
    strategicRisk,
    methodologyVersion: "findings-v1",
    fetchedAt: new Date().toISOString(),
  });
}
