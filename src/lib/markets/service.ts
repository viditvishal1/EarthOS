import { readModuleLiveCached } from "@/lib/live/module-cache";
import { runConnector } from "@/lib/connectors";
import type { Item } from "@/lib/types";
import { listMarketInstruments } from "@/lib/markets/instruments";
import { fetchEquityQuote } from "@/lib/markets/equity";

export interface MarketQuote {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  changePct: number;
  currency: string;
  provider: string;
  dataDelay: string;
  observedAt: string;
  url?: string;
}

export async function fetchMarketQuotes(limit = 20): Promise<{
  quotes: MarketQuote[];
  macro: Item[];
  attribution: string;
  disclaimer: string;
}> {
  const instruments = (await listMarketInstruments()).slice(0, limit);
  const quotes: MarketQuote[] = [];

  const marketModule = await readModuleLiveCached("markets");
  const cachedCrypto = (marketModule?.data ?? []).filter((i) => i.tags.includes("crypto"));

  for (const inst of instruments) {
    if (inst.instrumentType === "crypto") continue;
    const q = await fetchEquityQuote(inst.symbol);
    if (!q) continue;
    quotes.push({
      id: inst.id,
      symbol: inst.symbol,
      name: inst.name,
      assetClass: inst.instrumentType,
      price: q.price,
      changePct: q.changePct,
      currency: q.currency,
      provider: q.provider,
      dataDelay: q.dataDelay,
      observedAt: q.observedAt,
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(inst.symbol)}`,
    });
  }

  for (const c of cachedCrypto.slice(0, 8)) {
    const price = Number(c.extra?.price ?? 0);
    quotes.push({
      id: c.id,
      symbol: String(c.extra?.symbol ?? c.title),
      name: c.title,
      assetClass: "crypto",
      price,
      changePct: Number(c.extra?.change24h ?? 0),
      currency: "USD",
      provider: "CoinGecko",
      dataDelay: "Near real-time · free tier",
      observedAt: c.timestamp,
      url: c.url,
    });
  }

  if (quotes.length < 3) {
    try {
      const items = await runConnector("coingecko_markets");
      for (const c of items.slice(0, 6)) {
        quotes.push({
          id: c.id,
          symbol: String(c.extra?.symbol ?? ""),
          name: c.title,
          assetClass: "crypto",
          price: Number(c.extra?.price ?? 0),
          changePct: Number(c.extra?.change24h ?? 0),
          currency: "USD",
          provider: "CoinGecko",
          dataDelay: "Near real-time · free tier",
          observedAt: c.timestamp,
          url: c.url,
        });
      }
    } catch {
      /* optional */
    }
  }

  const macroModule = await readModuleLiveCached("macro");
  const macro = macroModule?.data ?? [];

  return {
    quotes,
    macro: macro.slice(0, 12),
    attribution: "Yahoo Finance · Stooq EOD · CoinGecko · World Bank · FRED · EIA",
    disclaimer: "Delayed data for context only — not exchange-grade real-time or investment advice",
  };
}
