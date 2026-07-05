import type { CctvCamera } from "@/lib/live/cctv/types";

type Ny511Camera = {
  Id?: number;
  Latitude?: number;
  Longitude?: number;
  Name?: string;
  ImageUrl?: string;
  VideoUrl?: string;
};

/** NYC-area traffic cameras via 511NY API (free key at https://511ny.org/developers). */
export async function fetchNycDotCameras(): Promise<CctvCamera[]> {
  const key = process.env.NYC_511_API_KEY?.trim();
  if (!key) return [];

  const url = `https://511ny.org/api/getcameras?key=${encodeURIComponent(key)}&format=json`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`nycdot_http_${res.status}`);

  const data = (await res.json()) as Ny511Camera[];
  const now = new Date().toISOString();

  return data
    .map((c): CctvCamera | null => {
      const lat = c.Latitude;
      const lng = c.Longitude;
      const imageUrl = c.ImageUrl;
      if (typeof lat !== "number" || typeof lng !== "number" || !imageUrl) return null;
      return {
        id: `nycdot:${c.Id ?? c.Name}`,
        source: "nycdot",
        title: c.Name ?? `NYC camera ${c.Id}`,
        lat,
        lng,
        imageUrl,
        refreshSeconds: 180,
        region: "NYC",
        lastSeenAt: now,
        status: "active",
      };
    })
    .filter((x): x is CctvCamera => x != null);
}
