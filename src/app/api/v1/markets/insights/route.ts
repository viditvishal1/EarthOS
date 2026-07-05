import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { generateMarketInsight } from "@/lib/markets/insights";
import { hybridSearch } from "@/lib/search/hybrid";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  const name = req.nextUrl.searchParams.get("q")?.trim() ?? symbol ?? "";
  const kind = (req.nextUrl.searchParams.get("kind") ?? "stock") as "crypto" | "stock" | "index";
  const price = Number(req.nextUrl.searchParams.get("price") ?? 0) || undefined;
  const changePct = Number(req.nextUrl.searchParams.get("changePct") ?? 0);

  if (!symbol && !name) {
    return noCacheJson({ error: "symbol or q required" }, { status: 400 });
  }

  const searchQ = name || symbol!;
  let news: Item[] = [];
  try {
    const result = await hybridSearch(searchQ, { limit: 12, liveFallback: true });
    news = result.items.filter((i) => i.module === "news").slice(0, 8);
  } catch {
    /* optional */
  }

  const insight = await generateMarketInsight({
    symbol: symbol ?? name,
    name,
    kind,
    price,
    changePct,
    news,
  });

  return noCacheJson({
    insight,
    news: news.map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      source: n.source,
      timestamp: n.timestamp,
      url: n.url,
    })),
    fetchedAt: new Date().toISOString(),
  });
}
