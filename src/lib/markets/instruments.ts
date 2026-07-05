import { getMarketInstruments } from "@/lib/config/sources";

export interface MarketInstrument {
  id: string;
  symbol: string;
  name: string;
  instrumentType: string;
  provider: string;
  exchange?: string;
  enabled: boolean;
}

export async function listMarketInstruments(): Promise<MarketInstrument[]> {
  const rows = await getMarketInstruments();
  return rows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      instrumentType: r.instrument_type,
      provider: r.provider === "stooq" ? "yahoo" : r.provider,
      exchange: r.exchange ?? undefined,
      enabled: r.enabled,
    }));
}
