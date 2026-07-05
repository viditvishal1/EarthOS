import type { CctvCamera } from "@/lib/live/cctv/types";

type VicCamera = {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  image_url?: string;
};

/**
 * VicRoads / Victoria AU traffic cameras.
 * Uses optional VICROADS_CAMERAS_URL when the public feed URL changes (AU DOT portals drift).
 */
export async function fetchVicRoadsCameras(): Promise<CctvCamera[]> {
  const custom = process.env.VICROADS_CAMERAS_URL?.trim();
  const url = custom || "https://data.vicroads.vic.gov.au/opendata/cameras.json";
  const res = await fetch(url, { next: { revalidate: 0 } }).catch(() => null);
  if (!res?.ok) throw new Error("vicroads_unavailable");

  const data = await res.json().catch(() => null);
  const list: VicCamera[] = Array.isArray(data) ? data : data?.cameras ?? data?.features ?? [];
  const now = new Date().toISOString();

  const cameras = list
    .map((c): CctvCamera | null => {
      const lat = c.lat ?? c.latitude;
      const lng = c.lng ?? c.longitude;
      const imageUrl = c.imageUrl ?? c.image_url;
      if (typeof lat !== "number" || typeof lng !== "number" || !imageUrl) return null;
      return {
        id: `vicroads:${c.id ?? c.name}`,
        source: "vicroads",
        title: c.name ?? String(c.id),
        lat,
        lng,
        imageUrl,
        refreshSeconds: 300,
        region: "Melbourne",
        lastSeenAt: now,
        status: "active",
      };
    })
    .filter((x): x is CctvCamera => x != null);

  if (cameras.length === 0) throw new Error("vicroads_empty");
  return cameras;
}
