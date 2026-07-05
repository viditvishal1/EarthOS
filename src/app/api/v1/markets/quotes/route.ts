import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { fetchMarketQuotes } from "@/lib/markets/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(40, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));
  const bundle = await fetchMarketQuotes(limit);
  return noCacheJson({
    quotes: bundle.quotes,
    macro: bundle.macro.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      source: m.source,
      module: m.module,
      timestamp: m.timestamp,
    })),
    count: bundle.quotes.length,
    attribution: bundle.attribution,
    disclaimer: bundle.disclaimer,
    fetchedAt: new Date().toISOString(),
  });
}
