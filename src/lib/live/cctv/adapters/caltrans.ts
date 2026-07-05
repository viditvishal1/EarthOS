import type { CctvCamera } from "@/lib/live/cctv/types";

type CaltransCctv = {
  index?: string;
  location?: { latitude?: string; longitude?: string; locationName?: string };
  imageData?: { static?: { currentImageURL?: string } };
  recordTimestamp?: { epoch?: number };
};

type CaltransDistrict = {
  cctv?: CaltransCctv[];
};

const DISTRICTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Caltrans CWWP2 district CCTV JSON — public snapshots; endpoints may be intermittently unavailable. */
export async function fetchCaltransCameras(): Promise<CctvCamera[]> {
  const now = new Date().toISOString();
  const out: CctvCamera[] = [];

  await Promise.all(
    DISTRICTS.map(async (d) => {
      const url = `https://cwwp2.dot.ca.gov/data/district/${d}/cctvStatusD${d}.json`;
      try {
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (!res.ok) return;
        const data = (await res.json()) as CaltransDistrict;
        for (const c of data.cctv ?? []) {
          const lat = Number(c.location?.latitude);
          const lng = Number(c.location?.longitude);
          const imageUrl = c.imageData?.static?.currentImageURL;
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || !imageUrl) continue;
          const idx = c.index ?? `${d}-${out.length}`;
          out.push({
            id: `caltrans:${idx}`,
            source: "caltrans",
            title: c.location?.locationName ?? `District ${d} camera ${idx}`,
            lat,
            lng,
            imageUrl,
            refreshSeconds: 300,
            region: "California",
            lastSeenAt: now,
            status: "active",
          });
        }
      } catch {
        /* district feed failed — other districts may succeed */
      }
    }),
  );

  if (out.length === 0) throw new Error("caltrans_all_districts_failed");
  return out;
}
