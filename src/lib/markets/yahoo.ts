import { fetchWithTimeout } from "@/lib/connectors/framework";

const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (Argus open-source dashboard)" };

export interface YahooQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  change7d?: number;
  currency: string;
  exchange: string;
  high52: number;
  low52: number;
  volume?: number;
  marketTime: string;
  sparkline?: number[];
}

interface YfChart {
  chart: {
    result?: {
      meta: {
        regularMarketPrice: number;
        chartPreviousClose: number;
        regularMarketTime: number;
        currency: string;
        exchangeName?: string;
        fullExchangeName?: string;
        shortName?: string;
        longName?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketVolume?: number;
      };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

function parseChart(data: YfChart, symbol: string): YahooQuote | null {
  const r = data.chart.result?.[0];
  if (!r) return null;
  const price = r.meta.regularMarketPrice;
  if (!Number.isFinite(price)) return null;
  const prev = r.meta.chartPreviousClose;
  const pct = prev ? ((price - prev) / prev) * 100 : 0;
  const closes = (r.indicators.quote[0]?.close ?? []).filter(
    (c): c is number => typeof c === "number" && !Number.isNaN(c),
  );
  const sparkline = closes.length >= 2 ? closes.slice(-7) : undefined;
  let change7d: number | undefined;
  if (closes.length >= 2) {
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first) change7d = ((last - first) / first) * 100;
  }
  return {
    symbol,
    name: r.meta.longName ?? r.meta.shortName ?? symbol,
    price,
    changePct: Math.round(pct * 100) / 100,
    change7d: change7d != null ? Math.round(change7d * 100) / 100 : undefined,
    currency: r.meta.currency ?? "USD",
    exchange: r.meta.fullExchangeName ?? r.meta.exchangeName ?? "—",
    high52: r.meta.fiftyTwoWeekHigh ?? price,
    low52: r.meta.fiftyTwoWeekLow ?? price,
    volume: r.meta.regularMarketVolume,
    marketTime: new Date(r.meta.regularMarketTime * 1000).toISOString(),
    sparkline,
  };
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  const res = await fetchWithTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
    { timeoutMs: 10000, headers: YF_HEADERS },
  );
  if (!res.ok) return null;
  const data: YfChart = await res.json();
  return parseChart(data, symbol);
}

export async function fetchYahooHistory(
  symbol: string,
  days = 365,
): Promise<{ date: string; close: number; volume?: number }[]> {
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
  return r.timestamp
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString(),
      close: closes[i] as number,
    }))
    .filter((p) => typeof p.close === "number" && !Number.isNaN(p.close));
}
