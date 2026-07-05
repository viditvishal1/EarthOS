import { fetchStooqQuote } from "@/lib/markets/stooq";
import { fetchYahooQuote, type YahooQuote } from "@/lib/markets/yahoo";

export interface EquityQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  change7d?: number;
  currency: string;
  exchange: string;
  high52?: number;
  low52?: number;
  volume?: number;
  observedAt: string;
  provider: string;
  dataDelay: string;
  sparkline?: number[];
}

function fromYahoo(q: YahooQuote): EquityQuote {
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    changePct: q.changePct,
    change7d: q.change7d,
    currency: q.currency,
    exchange: q.exchange,
    high52: q.high52,
    low52: q.low52,
    volume: q.volume,
    observedAt: q.marketTime,
    provider: "Yahoo Finance",
    dataDelay: "Delayed · not exchange-grade real-time",
    sparkline: q.sparkline,
  };
}

/** Yahoo first (works server-side); Stooq EOD as fallback when Yahoo fails. */
export async function fetchEquityQuote(symbol: string): Promise<EquityQuote | null> {
  const yahoo = await fetchYahooQuote(symbol);
  if (yahoo) return fromYahoo(yahoo);

  const stooq = await fetchStooqQuote(symbol);
  if (!stooq) return null;
  const pct = stooq.open ? ((stooq.close - stooq.open) / stooq.open) * 100 : 0;
  return {
    symbol,
    name: symbol,
    price: stooq.close,
    changePct: Math.round(pct * 100) / 100,
    currency: "USD",
    exchange: "EOD",
    observedAt: stooq.date,
    provider: "Stooq EOD",
    dataDelay: "End-of-day delayed — not investment advice",
  };
}
