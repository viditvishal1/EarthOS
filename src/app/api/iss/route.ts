import { NextResponse } from "next/server";
import { fetchIss } from "@/lib/connectors";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { readLive } from "@/lib/live/store";

export const dynamic = "force-dynamic";

type IssPosition = Awaited<ReturnType<typeof fetchIss>>;

export async function GET() {
  const result = await readLive<IssPosition | null>(
    "iss:position",
    fetchIss,
    {
      ttlSeconds: LIVE_SOFT_TTL.iss,
      source: "wheretheiss.at",
      fallback: null,
      coldTimeoutMs: 6_000,
      refreshWhenStale: true,
      seedEmpty: false,
      allowColdFetch: true,
      isEmpty: (d) => d == null,
    },
  );

  if (!result.data) {
    return NextResponse.json(
      { error: "ISS position unavailable", stale: result.stale, cold: result.cold },
      { status: result.cold ? 503 : 502 },
    );
  }

  return NextResponse.json({
    ...result.data,
    stale: result.stale,
    cold: result.cold,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    updatedAt: result.updatedAt,
    source: result.source,
  });
}
