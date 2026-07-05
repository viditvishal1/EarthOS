import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import {
  isKnownSatelliteGroup,
  listSatelliteGroups,
} from "@/lib/satellites/registry";
import { readSatelliteGroupBundle } from "@/lib/satellites/store";

export const dynamic = "force-dynamic";

/** CelesTrak TLE catalog with optional server-propagated positions. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const group = p.get("group") ?? "stations";
  const category = p.get("category");
  const includePositions = p.get("positions") !== "false";

  if (!isKnownSatelliteGroup(group)) {
    return noCacheJson({
      error: "unknown group",
      groups: listSatelliteGroups().map((g) => ({ id: g.id, label: g.label, category: g.category })),
    }, { status: 400 });
  }

  const bundle = await readSatelliteGroupBundle(group, { includePositions });
  if (!bundle || bundle.tleCount === 0) {
    return noCacheJson({
      group,
      satellites: [],
      positions: [],
      count: 0,
      dataFreshness: "cold",
      stale: true,
      cold: true,
      attribution: "CelesTrak / SGP4",
      note: "Run live cron seed or wait for satellites:tle cache",
      fetchedAt: new Date().toISOString(),
    });
  }

  let tles = bundle.tles;
  if (category) {
    tles = tles.filter((t) => t.category === category);
  }

  return noCacheJson({
    group: bundle.group,
    label: bundle.label,
    category: bundle.category,
    satellites: tles,
    positions: includePositions ? bundle.positions : [],
    count: tles.length,
    partial: bundle.positionsPartial,
    dataFreshness: bundle.positions.some((x) => x.stale) ? "stale" : "fresh",
    stale: tles.some((t) => t.stale),
    attribution: bundle.attribution,
    epochNote: "TLE epoch age shown per satellite; suppress live language when stale=true",
    fetchedAt: bundle.fetchedAt,
  });
}
