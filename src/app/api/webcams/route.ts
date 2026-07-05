import { NextResponse } from "next/server";
import { readLive } from "@/lib/live/store";
import { curatedWebcams, fetchAllWebcams, type Webcam } from "@/lib/live/webcams";
import { LIVE_SOFT_TTL } from "@/lib/live/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const curated = curatedWebcams();

  const result = await readLive<Webcam[]>(
    "webcams:all",
    fetchAllWebcams,
    {
      ttlSeconds: LIVE_SOFT_TTL.webcams,
      source: "Curated + Windy",
      fallback: curated,
      coldTimeoutMs: 6000,
      refreshWhenStale: true,
      seedEmpty: false,
      allowColdFetch: true,
    },
  );

  return NextResponse.json({
    items: result.data.length ? result.data : curated,
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
    source: result.source,
    fetchedAt: new Date().toISOString(),
  });
}
