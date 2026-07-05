import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { computeCiiV1 } from "@/lib/intelligence/cii/v1";
import { readModuleLiveCached } from "@/lib/live/module-cache";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadItems(): Promise<Item[]> {
  const mods = await Promise.all(
    ["earth", "news", "conflict", "cyber"].map((m) => readModuleLiveCached(m)),
  );
  return mods.flatMap((r) => r?.data ?? []);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ iso2: string }> },
) {
  const { iso2 } = await ctx.params;
  const items = await loadItems();
  const snapshot = computeCiiV1(iso2, items);
  return noCacheJson({ ...snapshot, fetchedAt: new Date().toISOString() });
}
