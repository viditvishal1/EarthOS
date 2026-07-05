import { NextResponse } from "next/server";
import { LIVE_CHANNELS } from "@/lib/config/live-channels";
import { readLive } from "@/lib/live/store";

export const dynamic = "force-dynamic";

// Public webcam feeds for the Cameras rail / webcam grid. Curated
// operator-published streams are keyless and always available; when
// WINDY_WEBCAMS_API_KEY is set we additionally sweep Windy Webcams v3 by
// region bounding box (24h TTL). Read-only from the live store.
const TTL_SECONDS = 86_400;

interface Webcam {
  id: string;
  title: string;
  place?: string;
  region: string;
  videoId?: string; // YouTube live id (curated)
  thumbnail?: string;
  url: string;
  provider: string;
}

const REGION_BBOX: Record<string, [number, number, number, number]> = {
  // lat_min, lon_min, lat_max, lon_max
  "middle-east": [12, 25, 42, 63],
  europe: [35, -11, 60, 40],
  americas: [-56, -170, 72, -34],
  asia: [-11, 60, 55, 155],
};

async function windyWebcams(): Promise<Webcam[]> {
  const key = process.env.WINDY_WEBCAMS_API_KEY;
  if (!key) return [];
  const out: Webcam[] = [];
  for (const [region, [laMin, loMin, laMax, loMax]] of Object.entries(REGION_BBOX)) {
    const res = await fetch(
      `https://api.windy.com/webcams/api/v3/webcams?limit=12&nearby=${(laMin + laMax) / 2},${(loMin + loMax) / 2},250&include=images,location`,
      { headers: { "x-windy-api-key": key } },
    ).catch(() => null);
    if (!res?.ok) continue;
    const data = await res.json().catch(() => null);
    for (const w of data?.webcams ?? []) {
      out.push({
        id: `windy:${w.webcamId}`,
        title: w.title,
        place: w.location?.city,
        region,
        thumbnail: w.images?.current?.preview,
        url: `https://www.windy.com/webcams/${w.webcamId}`,
        provider: "Windy Webcams",
      });
    }
  }
  return out;
}

export async function GET() {
  const curated: Webcam[] = LIVE_CHANNELS.filter((c) => c.category === "webcam" || c.category === "space").map((c) => ({
    id: c.id,
    title: c.name,
    place: c.place,
    region: c.region,
    videoId: c.videoId,
    thumbnail: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
    url: c.channelUrl,
    provider: c.provider,
  }));

  const result = await readLive<Webcam[]>(
    "webcams:all",
    async () => [...curated, ...(await windyWebcams())],
    { ttlSeconds: TTL_SECONDS, source: "Curated + Windy", fallback: curated, coldTimeoutMs: 6000 },
  );

  return NextResponse.json({
    items: result.data.length ? result.data : curated,
    stale: result.stale,
    updatedAt: result.updatedAt,
    fetchedAt: new Date().toISOString(),
  });
}
