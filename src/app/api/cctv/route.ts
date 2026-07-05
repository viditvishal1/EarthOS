import { NextRequest, NextResponse } from "next/server";
import { queryCameras } from "@/lib/cameras/service";
import { noCacheJson } from "@/lib/http/no-cache";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

/** Legacy CCTV route — delegates to v1 camera read model. */
export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cctv");

  const region = req.nextUrl.searchParams.get("region");
  const source = req.nextUrl.searchParams.get("source");

  const result = await queryCameras({
    provider: source ?? undefined,
    region: region ?? undefined,
    limit: 5000,
  });

  const body = {
    cameras: result.cameras.map((c) => ({
      id: c.id,
      source: c.provider,
      title: c.title,
      lat: c.lat,
      lng: c.lng,
      imageUrl: c.imageUrl ?? "",
      refreshSeconds: c.refreshSeconds,
      region: c.region,
      lastSeenAt: c.lastSeenAt,
      status: c.status,
      legalMode: c.legalMode,
      healthReason: c.healthReason,
      attribution: c.attribution,
    })),
    count: result.count,
    snapshotNote: "Still-image snapshots — not live video streams",
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    source: result.source,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
      Deprecation: "true",
      Link: '</api/v1/cameras>; rel="successor-version"',
    },
  });
}
