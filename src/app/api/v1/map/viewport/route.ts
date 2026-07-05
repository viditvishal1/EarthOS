import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import {
  fetchViewportLayers,
  parseLayerList,
  parseViewport,
} from "@/lib/map/viewport-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Multi-layer viewport API — bbox-bounded, no global browser fan-out. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const vp = parseViewport(p);
  if (!vp) {
    return noCacheJson({ error: "west,south,east,north required" }, { status: 400 });
  }

  const layers = parseLayerList(p.get("layers") ?? p.get("layer"));
  const from = p.get("from") ?? undefined;
  const to = p.get("to") ?? undefined;

  const layerData = await fetchViewportLayers(vp, layers);

  return noCacheJson({
    viewport: vp,
    layers: layerData,
    filters: { from, to },
    dataFreshness: "live",
    fetchedAt: new Date().toISOString(),
  });
}
