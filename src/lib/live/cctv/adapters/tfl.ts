import type { CctvCamera } from "@/lib/live/cctv/types";

type TflPlace = {
  id?: string;
  commonName?: string;
  lat?: number;
  lon?: number;
  additionalProperties?: Array<{ key?: string; value?: string }>;
};

function prop(place: TflPlace, key: string): string | undefined {
  return place.additionalProperties?.find((p) => p.key === key)?.value;
}

/** Transport for London JamCams — keyless at low volume; optional TFL_APP_KEY for higher limits. */
export async function fetchTflCameras(): Promise<CctvCamera[]> {
  const appKey = process.env.TFL_APP_KEY?.trim();
  const url = new URL("https://api.tfl.gov.uk/Place/Type/JamCam");
  if (appKey) url.searchParams.set("app_key", appKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`tfl_http_${res.status}`);

  const places = (await res.json()) as TflPlace[];
  const now = new Date().toISOString();

  return places
    .map((p): CctvCamera | null => {
      const lat = p.lat;
      const lng = p.lon;
      const imageUrl = prop(p, "imageUrl");
      if (typeof lat !== "number" || typeof lng !== "number" || !imageUrl || !p.id) return null;
      if (prop(p, "available") === "false") return null;
      return {
        id: `tfl:${p.id}`,
        source: "tfl",
        title: p.commonName ?? p.id,
        lat,
        lng,
        imageUrl,
        refreshSeconds: 120,
        region: "London",
        lastSeenAt: now,
        status: "active",
      };
    })
    .filter((c): c is CctvCamera => c != null);
}
