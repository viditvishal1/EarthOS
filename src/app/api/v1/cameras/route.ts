import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { queryCameras } from "@/lib/cameras/service";
import { CAMERA_PROVIDERS } from "@/lib/cameras/registry";

export const dynamic = "force-dynamic";

/** Agency traffic cameras — Redis read-only, bbox/provider filters, allowlisted URLs. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const west = p.has("west") ? Number(p.get("west")) : undefined;
  const south = p.has("south") ? Number(p.get("south")) : undefined;
  const east = p.has("east") ? Number(p.get("east")) : undefined;
  const north = p.has("north") ? Number(p.get("north")) : undefined;

  if ([west, south, east, north].some((v) => v !== undefined && !Number.isFinite(v!))) {
    return noCacheJson({ error: "invalid bbox" }, { status: 400 });
  }

  const result = await queryCameras({
    west,
    south,
    east,
    north,
    provider: p.get("provider") ?? undefined,
    status: (p.get("status") as "active" | "stale" | "offline" | null) ?? undefined,
    region: p.get("region") ?? undefined,
    limit: Math.min(1000, Math.max(1, Number(p.get("limit") ?? 500))),
  });

  return noCacheJson({
    cameras: result.cameras,
    count: result.count,
    providers: CAMERA_PROVIDERS.map((x) => ({
      id: x.id,
      label: x.label,
      legalMode: x.legalMode,
      regions: x.regions,
    })),
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    source: result.source,
    snapshotNote: "Still-image snapshots — not live video; no arbitrary URL proxy",
    attribution: "Per-provider agency open-data feeds",
    fetchedAt: new Date().toISOString(),
  });
}
