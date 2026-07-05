import { NextRequest, NextResponse } from "next/server";
import { fetchFlights, REGIONS } from "@/lib/connectors";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { readLive, readLiveCached } from "@/lib/live/store";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOURCE = "OpenSky/adsb.lol/Wingbits";

async function readFlightsRegion(region: string) {
  return readLive<Item[]>(
    `flights:${region}`,
    async () => {
      if (region === "global") {
        try {
          return await fetchFlights("global", "fast");
        } catch {
          return [];
        }
      }
      return fetchFlights(region, "fast");
    },
    {
      ttlSeconds: LIVE_SOFT_TTL.flights,
      source: SOURCE,
      fallback: [],
      coldTimeoutMs: 12_000,
      refreshWhenStale: true,
      seedEmpty: false,
      allowColdFetch: true,
    },
  );
}

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") ?? "global";
  if (!REGIONS[region]) {
    return NextResponse.json({ error: "unknown region", regions: Object.keys(REGIONS) }, { status: 400 });
  }

  let result = await readFlightsRegion(region);

  if (region === "global" && result.data.length === 0) {
    for (const fallback of ["europe", "usa", "india"] as const) {
      const alt = await readLiveCached<Item[]>(`flights:${fallback}`, {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source: SOURCE,
        fallback: [],
      });
      if (alt.data.length > 0) {
        result = { ...alt, source: `${alt.source} (fallback:${fallback})`, cold: result.cold };
        break;
      }
    }
  }

  return NextResponse.json({
    items: result.data,
    region,
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    source: result.source,
    fetchedAt: new Date().toISOString(),
  });
}
