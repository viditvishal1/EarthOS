import { NextResponse } from "next/server";
import { readLive } from "@/lib/live/store";
import { curatedWebcams, fetchAllWebcams, type Webcam } from "@/lib/live/webcams";

export const dynamic = "force-dynamic";

const TTL_SECONDS = 86_400;

export async function GET() {
  const curated = curatedWebcams();

  const result = await readLive<Webcam[]>(
    "webcams:all",
    fetchAllWebcams,
    { ttlSeconds: TTL_SECONDS, source: "Curated + Windy", fallback: curated, coldTimeoutMs: 6000 },
  );

  return NextResponse.json({
    items: result.data.length ? result.data : curated,
    stale: result.stale,
    updatedAt: result.updatedAt,
    fetchedAt: new Date().toISOString(),
  });
}
