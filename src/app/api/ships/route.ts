import { NextResponse } from "next/server";
import { runConnector } from "@/lib/connectors";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { readLive } from "@/lib/live/store";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const result = await readLive<Item[]>(
    "ships:global",
    async () => {
      const items = await runConnector("aishub_vessels");
      return items.filter((i) => typeof i.lat === "number");
    },
    {
      ttlSeconds: LIVE_SOFT_TTL.ships,
      source: "AISHub",
      fallback: [],
      coldTimeoutMs: 8000,
      refreshWhenStale: true,
      seedEmpty: false,
      allowColdFetch: true,
    },
  );

  return NextResponse.json({
    items: result.data,
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    source: result.source,
    fetchedAt: new Date().toISOString(),
  });
}
