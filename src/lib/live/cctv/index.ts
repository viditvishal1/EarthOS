import { fetchCaltransCameras } from "@/lib/live/cctv/adapters/caltrans";
import { fetchNycDotCameras } from "@/lib/live/cctv/adapters/nycdot";
import { fetchTflCameras } from "@/lib/live/cctv/adapters/tfl";
import { fetchVicRoadsCameras } from "@/lib/live/cctv/adapters/vicroads";
import { fetchWsdotCameras } from "@/lib/live/cctv/adapters/wsdot";
import {
  CCTV_SOURCES,
  type CctvCamera,
  type CctvSource,
} from "@/lib/live/cctv/types";

export type { CctvCamera, CctvSource };
export { CCTV_SOURCES };

function envEnabled(flag: string | undefined): boolean {
  return flag !== "false" && flag !== "0";
}

export interface CctvAdapter {
  id: CctvSource;
  envFlag: string;
  sourceLabel: string;
  fetch: () => Promise<CctvCamera[]>;
}

export const CCTV_ADAPTERS: CctvAdapter[] = [
  { id: "tfl", envFlag: "CCTV_ENABLE_TFL", sourceLabel: "TfL JamCams", fetch: fetchTflCameras },
  { id: "wsdot", envFlag: "CCTV_ENABLE_WSDOT", sourceLabel: "WSDOT", fetch: fetchWsdotCameras },
  { id: "caltrans", envFlag: "CCTV_ENABLE_CALTRANS", sourceLabel: "Caltrans", fetch: fetchCaltransCameras },
  { id: "nycdot", envFlag: "CCTV_ENABLE_NYCDOT", sourceLabel: "NYC DOT / 511NY", fetch: fetchNycDotCameras },
  { id: "vicroads", envFlag: "CCTV_ENABLE_VICROADS", sourceLabel: "VicRoads", fetch: fetchVicRoadsCameras },
];

export function isAdapterEnabled(adapter: CctvAdapter): boolean {
  const raw = process.env[adapter.envFlag];
  if (raw === undefined || raw === "") return true;
  return envEnabled(raw);
}

export async function fetchCctvBySource(source: CctvSource): Promise<CctvCamera[]> {
  const adapter = CCTV_ADAPTERS.find((a) => a.id === source);
  if (!adapter || !isAdapterEnabled(adapter)) return [];
  return adapter.fetch();
}

export async function fetchAllCctvCameras(): Promise<CctvCamera[]> {
  const batches = await Promise.all(
    CCTV_ADAPTERS.filter(isAdapterEnabled).map(async (a) => {
      try {
        return await a.fetch();
      } catch {
        return [];
      }
    }),
  );
  return batches.flat();
}

export function cctvDomainKey(source: CctvSource): string {
  return `cctv:${source}`;
}

export function cctvAggregateDomain(): string {
  return "cctv:all";
}
