import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { listMarketInstruments } from "@/lib/markets/instruments";

export const dynamic = "force-dynamic";

export async function GET() {
  const instruments = await listMarketInstruments();
  return noCacheJson({
    instruments,
    count: instruments.length,
    defaultProvider: "stooq",
    dataDelay: "EOD delayed — not exchange-grade real-time",
    fetchedAt: new Date().toISOString(),
  });
}
