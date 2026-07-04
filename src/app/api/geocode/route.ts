import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/connectors/framework";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __geocodeCache?: Map<string, { at: number; data: unknown }> };
const cache = (g.__geocodeCache ??= new Map());

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (!lat || !lon) return NextResponse.json({ error: "lat and lon required" }, { status: 400 });

  const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);

  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1`,
      {
        timeoutMs: 10000,
        headers: { "Accept-Language": "en", "User-Agent": "EarthOS/2.0 (city digital twin)" },
      },
    );
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    const addr = data.address ?? {};
    const out = {
      displayName: data.display_name as string,
      city: addr.city ?? addr.town ?? addr.village ?? addr.suburb ?? addr.state_district,
      state: addr.state ?? addr.region,
      country: addr.country,
      countryCode: addr.country_code,
      lat: Number(lat),
      lon: Number(lon),
    };
    cache.set(key, { at: Date.now(), data: out });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "geocode failed" },
      { status: 502 },
    );
  }
}
