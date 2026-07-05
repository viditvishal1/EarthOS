import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { getObservations } from "@/lib/observations/service";
import type { ObservationCategory } from "@/lib/observations/types";

export const dynamic = "force-dynamic";

function parseBbox(params: URLSearchParams): [number, number, number, number] | undefined {
  const west = Number(params.get("west") ?? params.get("minLon"));
  const south = Number(params.get("south") ?? params.get("minLat"));
  const east = Number(params.get("east") ?? params.get("maxLon"));
  const north = Number(params.get("north") ?? params.get("maxLat"));
  if ([west, south, east, north].some((n) => Number.isNaN(n))) return undefined;
  return [west, south, east, north];
}

/** Normalized observations with optional clustering — metadata/excerpt only per source policy. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const category = p.get("category") as ObservationCategory | null;
  const severityMin = p.get("severityMin") ? Number(p.get("severityMin")) : undefined;
  const source = p.get("source") ?? undefined;
  const from = p.get("from") ?? undefined;
  const to = p.get("to") ?? undefined;
  const cluster = p.get("cluster") === "true";
  const limit = p.get("limit") ? Number(p.get("limit")) : 200;
  const bbox = parseBbox(p);

  const result = await getObservations({
    bbox,
    from,
    to,
    category: category ?? undefined,
    severityMin,
    source,
    cluster,
    limit,
  });

  return noCacheJson({
    observations: result.observations,
    clusters: result.clusters,
    count: result.observations.length,
    dataFreshness: result.stale ? "stale" : result.cold ? "cold" : "fresh",
    stale: result.stale,
    cold: result.cold,
    updatedAt: result.updatedAt,
    attribution: "Per-observation provenance.attribution — no universal truth score",
    partial: false,
    fetchedAt: new Date().toISOString(),
  });
}
