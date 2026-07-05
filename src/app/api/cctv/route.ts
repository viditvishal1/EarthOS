import { NextRequest, NextResponse } from "next/server";
import { readAllCctvCached } from "@/lib/live/cctv/seed";
import { noCacheJson } from "@/lib/http/no-cache";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import { readLiveCached } from "@/lib/live/store";
import type { CctvCamera } from "@/lib/live/cctv";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

/** Redis-read-only traffic camera feed — no upstream agency calls. */
export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cctv");

  const region = req.nextUrl.searchParams.get("region");
  const source = req.nextUrl.searchParams.get("source");

  let cameras: CctvCamera[];
  let meta: { stale: boolean; cold: boolean; updatedAt: string | null; ageSeconds: number | null; source: string };

  if (source) {
    const result = await readLiveCached<CctvCamera[]>(`cctv:${source}`, {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source,
      fallback: [],
    });
    cameras = result.data;
    meta = {
      stale: result.stale,
      cold: result.cold,
      updatedAt: result.updatedAt,
      ageSeconds: result.ageSeconds == null ? null : Math.round(result.ageSeconds),
      source: result.source,
    };
  } else {
    const agg = await readLiveCached<CctvCamera[]>("cctv:all", {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source: "TfL/WSDOT/Caltrans/NYC/VicRoads",
      fallback: [],
    });
    cameras = agg.data.length > 0 ? agg.data : await readAllCctvCached();
    meta = {
      stale: agg.stale,
      cold: agg.cold && cameras.length === 0,
      updatedAt: agg.updatedAt,
      ageSeconds: agg.ageSeconds == null ? null : Math.round(agg.ageSeconds),
      source: agg.source,
    };
  }

  const filtered = region
    ? cameras.filter((c) => c.region.toLowerCase() === region.toLowerCase())
    : cameras;

  return noCacheJson({
    cameras: filtered,
    count: filtered.length,
    snapshotNote: "Still-image snapshots — not live video streams",
    ...meta,
    fetchedAt: new Date().toISOString(),
  });
}
