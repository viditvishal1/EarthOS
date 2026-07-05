import { NextResponse } from "next/server";
import { runConnector } from "@/lib/connectors";
import { readLive } from "@/lib/live/store";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Read-only from the shared live store (stale-while-revalidate). AIS vessel
// positions come from AISHub (key-gated); without a key this returns an empty
// last-known-good set rather than blocking. Soft TTL ~45s.
const TTL_SECONDS = 45;

export async function GET() {
  const result = await readLive<Item[]>(
    "ships:global",
    async () => {
      const items = await runConnector("aishub_vessels");
      return items.filter((i) => typeof i.lat === "number");
    },
    { ttlSeconds: TTL_SECONDS, source: "AISHub", fallback: [], coldTimeoutMs: 8000 },
  );

  return NextResponse.json({
    items: result.data,
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    fetchedAt: new Date().toISOString(),
  });
}
