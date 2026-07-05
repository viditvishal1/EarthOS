import { LIVE_CHANNELS } from "@/lib/config/live-channels";

export interface Webcam {
  id: string;
  title: string;
  place?: string;
  region: string;
  lat?: number;
  lon?: number;
  videoId?: string;
  thumbnail?: string;
  url: string;
  provider: string;
}

/** Approximate coords for curated operator webcams (city-level). */
const PLACE_COORDS: Record<string, [number, number]> = {
  Jerusalem: [31.7767, 35.2345],
  Mecca: [21.4225, 39.8262],
  Kyiv: [50.4501, 30.5234],
  London: [51.532, -0.177],
  "New York": [40.758, -73.9855],
  Miami: [25.7906, -80.13],
  Taipei: [25.033, 121.5654],
  Shanghai: [31.2304, 121.4737],
  Tokyo: [35.6762, 139.6503],
  Seoul: [37.5665, 126.978],
  Sydney: [-33.8688, 151.2093],
};

const REGION_BBOX: Record<string, [number, number, number, number]> = {
  "middle-east": [12, 25, 42, 63],
  europe: [35, -11, 60, 40],
  americas: [-56, -170, 72, -34],
  asia: [-11, 60, 55, 155],
};

export function curatedWebcams(): Webcam[] {
  return LIVE_CHANNELS.filter((c) => c.category === "webcam" || c.category === "space").map((c) => {
    const coords = c.place ? PLACE_COORDS[c.place] : undefined;
    return {
      id: c.id,
      title: c.name,
      place: c.place,
      region: c.region,
      lat: coords?.[0],
      lon: coords?.[1],
      videoId: c.videoId,
      thumbnail: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
      url: c.channelUrl,
      provider: c.provider,
    };
  });
}

export async function fetchWindyWebcams(): Promise<Webcam[]> {
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
        lat: w.location?.latitude,
        lon: w.location?.longitude,
        thumbnail: w.images?.current?.preview,
        url: `https://www.windy.com/webcams/${w.webcamId}`,
        provider: "Windy Webcams",
      });
    }
  }
  return out;
}

export async function fetchAllWebcams(): Promise<Webcam[]> {
  const curated = curatedWebcams();
  const windy = await fetchWindyWebcams();
  return [...curated, ...windy];
}
