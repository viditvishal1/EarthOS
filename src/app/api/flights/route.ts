import { NextRequest, NextResponse } from "next/server";
import { fetchFlights, REGIONS } from "@/lib/connectors";
import { readLive } from "@/lib/live/store";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Read-only from the shared live store (Redis, stale-while-revalidate). The
// request path never blocks on OpenSky/adsb.lol when a cached value exists —
// it returns the last-known-good positions immediately and refreshes in the
// background. Regions refresh on a ~75s soft TTL.
const TTL_SECONDS = 75;

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") ?? "europe";
  if (!REGIONS[region]) {
    return NextResponse.json({ error: "unknown region", regions: Object.keys(REGIONS) }, { status: 400 });
  }

  const result = await readLive<Item[]>(
    `flights:${region}`,
    () => fetchFlights(region),
    { ttlSeconds: TTL_SECONDS, source: "OpenSky/adsb.lol", fallback: [], coldTimeoutMs: 8000 },
  );

  return NextResponse.json({
    items: result.data,
    region,
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    fetchedAt: new Date().toISOString(),
  });
}
