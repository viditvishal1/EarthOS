import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/connectors/framework";

export const dynamic = "force-dynamic";

const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (Argus open-source dashboard)" };

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "crypto";
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    if (kind === "crypto") {
      const res = await fetchWithTimeout(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { timeoutMs: 15000 },
      );
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const c = await res.json();
      const md = c.market_data ?? {};
      return NextResponse.json({
        kind: "crypto",
        id: c.id,
        name: c.name,
        symbol: String(c.symbol).toUpperCase(),
        image: c.image?.large,
        rank: c.market_cap_rank,
        price: md.current_price?.usd,
        change24h: md.price_change_percentage_24h,
        change7d: md.price_change_percentage_7d,
        change30d: md.price_change_percentage_30d,
        marketCap: md.market_cap?.usd,
        volume24h: md.total_volume?.usd,
        fdv: md.fully_diluted_valuation?.usd,
        circulating: md.circulating_supply,
        total: md.total_supply,
        max: md.max_supply,
        ath: md.ath?.usd,
        athChange: md.ath_change_percentage?.usd,
        atl: md.atl?.usd,
        high24h: md.high_24h?.usd,
        low24h: md.low_24h?.usd,
        description: (c.description?.en ?? "").replace(/<[^>]+>/g, "").slice(0, 600),
        homepage: c.links?.homepage?.[0],
        whitepaper: c.links?.whitepaper,
        fetchedAt: new Date().toISOString(),
      });
    }

    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id)}?range=1y&interval=1d`,
      { timeoutMs: 12000, headers: YF_HEADERS },
    );
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    const r = data.chart?.result?.[0];
    if (!r) throw new Error("no chart data");
    const m = r.meta;
    const pct = m.chartPreviousClose ? ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose) * 100 : 0;
    return NextResponse.json({
      kind: "stock",
      id,
      name: m.shortName ?? m.symbol,
      symbol: m.symbol,
      price: m.regularMarketPrice,
      change24h: pct,
      currency: m.currency,
      exchange: m.exchangeName,
      high52: m.fiftyTwoWeekHigh,
      low52: m.fiftyTwoWeekLow,
      volume: m.regularMarketVolume,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
