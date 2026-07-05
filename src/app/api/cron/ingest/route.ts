import { NextRequest, NextResponse } from "next/server";
import { runScheduledIngestion } from "@/lib/ingest/scheduler";
import { trackApiRequest } from "@/lib/usage/tracker";
import { fetchFlights } from "@/lib/connectors";
import { seedLive } from "@/lib/live/store";
import type { Item } from "@/lib/types";

// Warm the live store for the map hero regions so the first reader after a
// cold start gets cached data instead of triggering an inline fetch.
const SEED_REGIONS = ["global", "europe", "usa"];

async function seedFlights(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.all(
    SEED_REGIONS.map(async (region) => {
      try {
        const items: Item[] = await fetchFlights(region);
        await seedLive(`flights:${region}`, items, "OpenSky/adsb.lol");
        counts[region] = items.length;
      } catch {
        counts[region] = -1;
      }
    }),
  );
  return counts;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/ingest");
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [result, flightSeed] = await Promise.all([
    runScheduledIngestion({ maxSources: 15 }),
    seedFlights(),
  ]);
  return NextResponse.json({
    ok: true,
    ...result,
    flightSeed,
    fetchedAt: new Date().toISOString(),
  });
}
