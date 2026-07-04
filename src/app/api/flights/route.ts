import { NextRequest, NextResponse } from "next/server";
import { fetchFlights, REGIONS } from "@/lib/connectors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const g = globalThis as unknown as {
  __flightsCache?: Map<string, { at: number; items: unknown[] }>;
};
const cache = (g.__flightsCache ??= new Map());

const CACHE_MS: Record<string, number> = {
  global: 120_000,
  europe: 60_000,
  usa: 60_000,
  india: 60_000,
  easia: 60_000,
  china: 60_000,
  africa: 60_000,
  mideast: 60_000,
};

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") ?? "europe";
  if (!REGIONS[region]) {
    return NextResponse.json({ error: "unknown region", regions: Object.keys(REGIONS) }, { status: 400 });
  }
  const ttl = CACHE_MS[region] ?? 60_000;
  const hit = cache.get(region);
  if (hit && Date.now() - hit.at < ttl) {
    return NextResponse.json({ items: hit.items, cached: true, region });
  }
  try {
    const items = await fetchFlights(region);
    cache.set(region, { at: Date.now(), items });
    return NextResponse.json({ items, fetchedAt: new Date().toISOString(), region, probeCount: REGIONS[region].probes.length });
  } catch (err) {
    return NextResponse.json(
      { items: hit?.items ?? [], error: err instanceof Error ? err.message : "fetch failed", region },
      { status: hit ? 200 : 502 },
    );
  }
}
