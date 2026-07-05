import { readAllCctvCached } from "@/lib/live/cctv/seed";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import type { CctvCamera, CctvCameraStatus, CctvSource } from "@/lib/live/cctv/types";
import {
  cameraAttribution,
  cameraLegalMode,
  isAllowlistedCameraUrl,
} from "@/lib/cameras/registry";

export interface CameraRecord {
  id: string;
  provider: CctvSource;
  title: string;
  lat: number;
  lng: number;
  legalMode: ReturnType<typeof cameraLegalMode>;
  imageUrl: string | null;
  refreshSeconds: number;
  region: string;
  status: CctvCameraStatus;
  healthReason?: string;
  attribution: string;
  lastSeenAt: string;
  snapshotNote: string;
}

export interface CameraQuery {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  provider?: string;
  status?: CctvCameraStatus;
  region?: string;
  limit?: number;
}

function toCameraRecord(c: CctvCamera): CameraRecord {
  const legalMode = cameraLegalMode(c.source);
  const urlOk = c.imageUrl ? isAllowlistedCameraUrl(c.source, c.imageUrl) : false;
  const imageUrl = urlOk ? c.imageUrl : null;
  let healthReason: string | undefined;
  if (!urlOk && c.imageUrl) healthReason = "embed_blocked";
  else if (c.status === "offline") healthReason = "provider_outage";
  else if (c.status === "stale") healthReason = "stale_snapshot";

  return {
    id: c.id,
    provider: c.source,
    title: c.title,
    lat: c.lat,
    lng: c.lng,
    legalMode: !imageUrl && legalMode === "image" ? "unavailable" : legalMode,
    imageUrl,
    refreshSeconds: c.refreshSeconds,
    region: c.region,
    status: c.status,
    healthReason,
    attribution: cameraAttribution(c.source),
    lastSeenAt: c.lastSeenAt,
    snapshotNote: "Still-image snapshots — not live video streams; no rebroadcast",
  };
}

function inBbox(c: CctvCamera, west: number, south: number, east: number, north: number): boolean {
  return c.lng >= west && c.lng <= east && c.lat >= south && c.lat <= north;
}

export async function queryCameras(q: CameraQuery): Promise<{
  cameras: CameraRecord[];
  count: number;
  stale: boolean;
  cold: boolean;
  updatedAt: string | null;
  source: string;
}> {
  let raw: CctvCamera[];
  let meta: { stale: boolean; cold: boolean; updatedAt: string | null; source: string };

  if (q.provider) {
    const result = await readLiveCached<CctvCamera[]>(`cctv:${q.provider}`, {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source: q.provider,
      fallback: [],
    });
    raw = result.data;
    meta = {
      stale: result.stale,
      cold: result.cold,
      updatedAt: result.updatedAt,
      source: result.source,
    };
  } else {
    const agg = await readLiveCached<CctvCamera[]>("cctv:all", {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source: "TfL/WSDOT/Caltrans/NYC/VicRoads",
      fallback: [],
    });
    raw = agg.data.length > 0 ? agg.data : await readAllCctvCached();
    meta = {
      stale: agg.stale,
      cold: agg.cold && raw.length === 0,
      updatedAt: agg.updatedAt,
      source: agg.source,
    };
  }

  let filtered = raw;

  if (q.region) {
    filtered = filtered.filter((c) => c.region.toLowerCase() === q.region!.toLowerCase());
  }
  if (q.status) {
    filtered = filtered.filter((c) => c.status === q.status);
  }
  if (
    typeof q.west === "number"
    && typeof q.south === "number"
    && typeof q.east === "number"
    && typeof q.north === "number"
  ) {
    filtered = filtered.filter((c) => inBbox(c, q.west!, q.south!, q.east!, q.north!));
  }

  const limit = q.limit ?? 500;
  const cameras = filtered.slice(0, limit).map(toCameraRecord);

  return {
    cameras,
    count: cameras.length,
    ...meta,
  };
}
