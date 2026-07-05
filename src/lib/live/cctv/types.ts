export type CctvSource = "tfl" | "wsdot" | "caltrans" | "nycdot" | "vicroads";

export type CctvCameraStatus = "active" | "stale" | "offline";

export interface CctvCamera {
  id: string;
  source: CctvSource;
  title: string;
  lat: number;
  lng: number;
  /** Static JPEG snapshot URL (refreshed upstream every refreshSeconds). */
  imageUrl: string;
  refreshSeconds: number;
  region: string;
  lastSeenAt: string;
  status: CctvCameraStatus;
}

export const CCTV_SOURCES: readonly CctvSource[] = [
  "tfl", "wsdot", "caltrans", "nycdot", "vicroads",
] as const;

export const CCTV_REDIS_TTL_SECONDS = 600;
