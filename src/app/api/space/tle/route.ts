// TLE proxy — CelesTrak two-line element sets for client-side orbit
// propagation (satellite.js). Cached 2h per group; TLEs stay valid for days.

import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/connectors/framework";

export const dynamic = "force-dynamic";

const GROUPS = new Set(["stations", "last-30-days", "active-geosynchronous", "weather", "gps-ops", "starlink"]);

const g = globalThis as unknown as { __tleCache?: Map<string, { at: number; text: string }> };
const cache = (g.__tleCache ??= new Map());

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get("group") ?? "stations";
  if (!GROUPS.has(group)) {
    return NextResponse.json({ error: "unknown group", groups: [...GROUPS] }, { status: 400 });
  }
  const hit = cache.get(group);
  if (hit && Date.now() - hit.at < 2 * 3600_000) {
    return new NextResponse(hit.text, { headers: { "Content-Type": "text/plain" } });
  }
  const res = await fetchWithTimeout(
    `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`,
    { timeoutMs: 15000 },
  );
  if (!res.ok) {
    return NextResponse.json({ error: `CelesTrak HTTP ${res.status}` }, { status: 502 });
  }
  const text = await res.text();
  cache.set(group, { at: Date.now(), text });
  return new NextResponse(text, { headers: { "Content-Type": "text/plain" } });
}
