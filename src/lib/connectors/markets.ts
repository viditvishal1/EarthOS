// Markets connectors — crypto via CoinGecko (free, no key), equities/indices
// via Yahoo Finance's public chart API (free, no key). In-app charting uses
// the history helpers below; nothing links out to an exchange for basic reading.

import { getMarketInstruments } from "@/lib/config/sources";
import { fetchEquityQuote } from "@/lib/markets/equity";
import { fetchYahooHistory } from "@/lib/markets/yahoo";
import { fetchStooqHistory } from "@/lib/markets/stooq";
import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

registerConnector(
  {
    id: "coingecko_markets",
    module: "markets",
    source: "CoinGecko",
    sourceUrl: "https://www.coingecko.com",
    scheduleSeconds: 180,
    contentPolicy: "full_cache",
    entityTypes: ["instrument"],
  },
  async () => {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=true&price_change_percentage=24h,7d,30d",
      { timeoutMs: 12000 },
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status} (free tier ~10 req/min)`);
    interface Coin {
      id: string; symbol: string; name: string; current_price: number;
      market_cap: number; price_change_percentage_24h: number | null;
      price_change_percentage_7d_in_currency: number | null;
      price_change_percentage_30d_in_currency?: number | null;
      total_volume: number; market_cap_rank: number;
      sparkline_in_7d?: { price: number[] };
      image?: string;
    }
    const coins: Coin[] = await res.json();
    return coins.map((c): Item => ({
      id: `crypto:${c.id}`,
      module: "markets",
      connectorId: "coingecko_markets",
      title: `${c.name} (${c.symbol.toUpperCase()})`,
      summary: `$${c.current_price.toLocaleString()} · 24h ${c.price_change_percentage_24h?.toFixed(2) ?? "0"}% · mcap $${(c.market_cap / 1e9).toFixed(1)}B`,
      source: "CoinGecko",
      url: `https://www.coingecko.com/en/coins/${c.id}`,
      timestamp: new Date().toISOString(),
      severity: Math.min(10, Math.abs(c.price_change_percentage_24h ?? 0)),
      severityLabel: `${(c.price_change_percentage_24h ?? 0) >= 0 ? "+" : ""}${c.price_change_percentage_24h?.toFixed(2) ?? 0}%`,
      tags: ["crypto"],
      entities: [{ name: c.name, type: "instrument" }],
      contentPolicy: "full_cache",
      extra: {
        price: c.current_price,
        change24h: c.price_change_percentage_24h,
        change7d: c.price_change_percentage_7d_in_currency,
        change30d: c.price_change_percentage_30d_in_currency,
        volume: c.total_volume,
        marketCap: c.market_cap,
        rank: c.market_cap_rank,
        assetClass: "crypto",
        symbol: c.symbol.toUpperCase(),
        coinId: c.id,
        sparkline: c.sparkline_in_7d?.price,
        image: c.image,
      },
    }));
  },
);

const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (Argus open-source dashboard)" };

async function instrumentSymbols(): Promise<{ s: string; name: string; assetClass: string; exchange?: string }[]> {
  const instruments = await getMarketInstruments();
  if (instruments.length > 0) {
    return instruments.map((i) => ({
      s: i.symbol,
      name: i.name,
      assetClass: i.instrument_type,
      exchange: i.exchange,
    }));
  }
  return [
    { s: "^GSPC", name: "S&P 500", assetClass: "index" },
    { s: "^DJI", name: "Dow Jones", assetClass: "index" },
    { s: "AAPL", name: "Apple", assetClass: "equity" },
    { s: "MSFT", name: "Microsoft", assetClass: "equity" },
    { s: "NVDA", name: "NVIDIA", assetClass: "equity" },
  ];
}

function equityItem(
  meta: { s: string; name: string; assetClass: string; exchange?: string },
  q: Awaited<ReturnType<typeof fetchEquityQuote>>,
  connectorId: string,
  sourceLabel: string,
): Item | null {
  if (!q) return null;
  return {
    id: `stock:${meta.s}`,
    module: "markets",
    connectorId,
    title: `${meta.name} (${meta.s.replace("^", "")})`,
    summary: `${q.price.toLocaleString()} ${q.currency} · ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% · ${q.exchange}`,
    source: sourceLabel,
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(meta.s)}`,
    timestamp: q.observedAt,
    severity: Math.min(10, Math.abs(q.changePct)),
    severityLabel: `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%`,
    tags: meta.assetClass === "index" ? ["index"] : ["equity"],
    entities: [{ name: meta.name, type: "instrument" }],
    contentPolicy: "full_cache",
    extra: {
      price: q.price,
      change24h: q.changePct,
      change7d: q.change7d,
      assetClass: meta.assetClass,
      symbol: meta.s,
      exchange: meta.exchange ?? q.exchange,
      currency: q.currency,
      dataDelay: q.dataDelay,
      provider: q.provider,
      sparkline: q.sparkline,
      high52: q.high52,
      low52: q.low52,
    },
  };
}

interface YfChart {
  chart: {
    result?: {
      meta: {
        regularMarketPrice: number;
        chartPreviousClose: number;
        regularMarketTime: number;
        currency: string;
      };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[]; volume?: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

registerConnector(
  {
    id: "stooq_eod",
    module: "markets",
    source: "Equity Markets",
    sourceUrl: "https://stooq.com",
    scheduleSeconds: 3600,
    contentPolicy: "full_cache",
    entityTypes: ["instrument"],
  },
  async () => {
    const symbols = await instrumentSymbols();
    const results = await Promise.allSettled(
      symbols.map(async (meta) => {
        const q = await fetchEquityQuote(meta.s);
        const item = equityItem(meta, q, "stooq_eod", q?.provider ?? "Yahoo Finance");
        if (!item) throw new Error("no quote");
        return item;
      }),
    );
    const items = results
      .filter((r): r is PromiseFulfilledResult<Item> => r.status === "fulfilled")
      .map((r) => r.value);
    if (items.length === 0) throw new Error("all equity quotes failed");
    return items;
  },
);

registerConnector(
  {
    id: "yahoo_quotes",
    module: "markets",
    source: "Yahoo Finance",
    sourceUrl: "https://finance.yahoo.com",
    scheduleSeconds: 300,
    contentPolicy: "full_cache",
    entityTypes: ["instrument"],
  },
  async () => {
    const symbols = await instrumentSymbols();
    const results = await Promise.allSettled(
      symbols.map(async (meta) => {
        const q = await fetchEquityQuote(meta.s);
        const item = equityItem(meta, q, "yahoo_quotes", q?.provider ?? "Yahoo Finance");
        if (!item) throw new Error("no quote");
        return item;
      }),
    );
    const items = results
      .filter((r): r is PromiseFulfilledResult<Item> => r.status === "fulfilled")
      .map((r) => r.value);
    if (items.length === 0) throw new Error("all Yahoo Finance quotes failed");
    return items;
  },
);

export const MARKETS_CONNECTOR_IDS = ["coingecko_markets", "stooq_eod"];

/** Daily close history — Yahoo first; Stooq EOD fallback. */
export async function fetchStockHistory(
  symbol: string,
  days = 365,
): Promise<{ date: string; close: number; volume?: number }[]> {
  const yahoo = await fetchYahooHistory(symbol, days);
  if (yahoo.length > 0) return yahoo;

  const stooq = await fetchStooqHistory(symbol, days);
  if (stooq.length > 0) return stooq;

  if (process.env.YAHOO_FINANCE_ENABLED !== "true") return [];

  const range = days <= 7 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : days <= 365 ? "1y" : "5y";
  const interval = days <= 7 ? "1h" : "1d";
  const res = await fetchWithTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
    { timeoutMs: 12000, headers: YF_HEADERS },
  );
  if (!res.ok) return [];
  const data: YfChart = await res.json();
  const r = data.chart.result?.[0];
  if (!r?.timestamp) return [];
  const closes = r.indicators.quote[0]?.close ?? [];
  const volumes = r.indicators.quote[0]?.volume ?? [];
  return r.timestamp
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString(),
      close: closes[i] as number,
      volume: volumes[i] as number | undefined,
    }))
    .filter((p) => typeof p.close === "number" && !Number.isNaN(p.close));
}

/** Price history from CoinGecko — days: 1|7|30|90|365|max */
export async function fetchCryptoHistory(
  id: string,
  days = 30,
): Promise<{ date: string; close: number; volume?: number }[]> {
  const d = days >= 365 ? "max" : String(days);
  const interval = days <= 1 ? "hourly" : "daily";
  const url =
    days === 1
      ? `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${d}`
      : `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${d}&interval=${interval}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 15000 });
  if (!res.ok) return [];
  const data = await res.json();
  const prices: [number, number][] = data.prices ?? [];
  const volumes: [number, number][] = data.total_volumes ?? [];
  const volMap = new Map(volumes.map(([t, v]) => [t, v]));
  return prices.map(([t, p]) => ({
    date: new Date(t).toISOString(),
    close: p,
    volume: volMap.get(t),
  }));
}
