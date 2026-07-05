import type { CctvCamera } from "@/lib/live/cctv/types";

type WsdotCamera = {
  CameraID?: number;
  CameraLocation?: { Latitude?: number; Longitude?: number; RoadName?: string; MilePost?: number };
  ImageURL?: string;
  Title?: string;
  DisplayLatitude?: number;
  DisplayLongitude?: number;
};

/** WSDOT Traveler Information API — requires free WSDOT_ACCESS_CODE from wsdot.wa.gov. */
export async function fetchWsdotCameras(): Promise<CctvCamera[]> {
  const code = process.env.WSDOT_ACCESS_CODE?.trim();
  if (!code) return [];

  const url = `https://wsdot.wa.gov/traffic/api/HighwayCameras/HighwayCamerasREST.svc/GetCamerasAsJson?AccessCode=${encodeURIComponent(code)}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`wsdot_http_${res.status}`);

  const text = await res.text();
  if (text.includes("Unathenticated") || text.includes("<html")) {
    throw new Error("wsdot_invalid_access_code");
  }

  const data = JSON.parse(text) as WsdotCamera[];
  const now = new Date().toISOString();

  return data
    .map((c): CctvCamera | null => {
      const lat = c.DisplayLatitude ?? c.CameraLocation?.Latitude;
      const lng = c.DisplayLongitude ?? c.CameraLocation?.Longitude;
      const imageUrl = c.ImageURL;
      if (typeof lat !== "number" || typeof lng !== "number" || !imageUrl) return null;
      const title = c.Title ?? c.CameraLocation?.RoadName ?? `Camera ${c.CameraID ?? "?"}`;
      return {
        id: `wsdot:${c.CameraID ?? title}`,
        source: "wsdot",
        title,
        lat,
        lng,
        imageUrl,
        refreshSeconds: 180,
        region: "Seattle",
        lastSeenAt: now,
        status: "active",
      };
    })
    .filter((x): x is CctvCamera => x != null);
}
