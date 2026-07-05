import { fetchWithTimeout } from "@/lib/connectors/framework";

export interface StooqQuote {
  symbol: string;
  stooqSymbol: string;
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

/** Map Yahoo-style symbols to Stooq tickers (EOD, delayed — not exchange-grade real-time). */
export function toStooqSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  const indexMap: Record<string, string> = {
    "^GSPC": "^SPX",
    "^DJI": "^DJI",
    "^IXIC": "^NDX",
    "^FTSE": "^FTSE",
    "^N225": "^N225",
  };
  if (indexMap[s]) return indexMap[s].toLowerCase();
  if (s.startsWith("^")) return s.toLowerCase();
  if (s.includes(".")) return s.toLowerCase();
  return `${s.toLowerCase()}.us`;
}

function parseQuoteLine(line: string, stooqSymbol: string): StooqQuote | null {
  const parts = line.trim().split(",");
  if (parts.length < 8) return null;
  const close = Number(parts[6]);
  if (!Number.isFinite(close)) return null;
  return {
    symbol: stooqSymbol,
    stooqSymbol,
    date: parts[1],
    open: Number(parts[3]) || close,
    high: Number(parts[4]) || close,
    low: Number(parts[5]) || close,
    close,
    volume: Number(parts[7]) || 0,
  };
}

export async function fetchStooqQuote(symbol: string): Promise<StooqQuote | null> {
  const stooqSymbol = toStooqSymbol(symbol);
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });
  if (!res.ok) return null;
  const text = await res.text();
  const line = text.split("\n").find((l) => l.includes(",") && !l.startsWith("Symbol"));
  if (!line) return null;
  return parseQuoteLine(line, stooqSymbol);
}

export async function fetchStooqHistory(
  symbol: string,
  limit = 365,
): Promise<{ date: string; close: number; volume?: number }[]> {
  const stooqSymbol = toStooqSymbol(symbol);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const res = await fetchWithTimeout(url, { timeoutMs: 15000 });
  if (!res.ok) return [];
  const lines = (await res.text()).split("\n").slice(1).filter(Boolean);
  return lines
    .slice(0, limit)
    .flatMap((line) => {
      const parts = line.split(",");
      const close = Number(parts[4]);
      if (!Number.isFinite(close)) return [];
      return [{
        date: parts[0],
        close,
        volume: Number(parts[5]) || undefined,
      }];
    })
    .reverse();
}
