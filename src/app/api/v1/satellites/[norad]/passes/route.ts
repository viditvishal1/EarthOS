import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import {
  groundTrack,
  predictPasses,
  propagatePosition,
} from "@/lib/satellites/tle";
import { loadParsedTleForNorad } from "@/lib/satellites/store";

export const dynamic = "force-dynamic";

/** Local pass prediction from cached TLE — no per-satellite upstream polling. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ norad: string }> },
) {
  const { norad } = await ctx.params;
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  const hours = Math.min(72, Math.max(1, Number(p.get("hours") ?? 24)));
  const minEl = Math.min(90, Math.max(0, Number(p.get("minElevation") ?? 10)));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return noCacheJson({ error: "lat and lon required" }, { status: 400 });
  }

  const tle = await loadParsedTleForNorad(norad);
  if (!tle) {
    return noCacheJson({ error: "satellite not found in cached TLE groups", norad }, { status: 404 });
  }

  const position = propagatePosition(tle);
  const passes = predictPasses(tle, lat, lon, hours, minEl);
  const trail = groundTrack(tle, new Date(), 50, 2);

  return noCacheJson({
    noradId: tle.noradId,
    name: tle.name,
    epochAgeHours: Math.round(tle.epochAgeHours * 10) / 10,
    stale: tle.stale,
    position,
    passes,
    groundTrack: trail,
    observer: { lat, lon },
    hours,
    attribution: "CelesTrak TLE + local SGP4 propagation",
    fetchedAt: new Date().toISOString(),
  });
}
