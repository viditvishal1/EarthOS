import { NextRequest, NextResponse } from "next/server";
import { parseViewport, filterByViewport, type MapPoint } from "@/lib/maps/viewport";
import { fetchFlightsByBbox } from "@/lib/connectors/aviation";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  await trackApiRequest("/api/map/viewport");
  const vp = parseViewport(req.nextUrl.searchParams);
  if (!vp) return NextResponse.json({ error: "west,south,east,north required" }, { status: 400 });

  const layer = req.nextUrl.searchParams.get("layer") ?? "aviation";
  let points: MapPoint[] = [];

  if (layer === "aviation") {
    const bbox: [number, number, number, number] = [vp.west, vp.south, vp.east, vp.north];
    const items = await fetchFlightsByBbox(bbox, { limit: vp.limit ?? 500 });
    points = items
      .filter((it) => typeof it.lat === "number" && typeof it.lon === "number")
      .map((it) => ({
        id: it.id,
        lat: it.lat!,
        lon: it.lon!,
        label: it.title,
        module: "aviation",
        heading: typeof it.extra?.heading === "number" ? it.extra.heading : undefined,
      }));
  }

  const filtered = filterByViewport(points, vp);
  return NextResponse.json({
    layer,
    viewport: vp,
    count: filtered.length,
    points: filtered,
    provider: layer === "aviation" ? "OpenSky/adsb.lol" : "Argus",
    fetchedAt: new Date().toISOString(),
  });
}
