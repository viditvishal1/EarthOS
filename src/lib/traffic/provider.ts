import { isInIndia } from "@/lib/geo/region";
import { enrichSegmentsWithRoadNames } from "@/lib/traffic/enrich";
import { fetchMapplsTrafficFlow, mapplsTrafficEnabled } from "@/lib/traffic/mappls";
import { fetchTomtomTrafficFlow, tomtomTrafficEnabled } from "@/lib/traffic/tomtom";
import type { TrafficBbox, TrafficFlowSegment, TrafficProvider } from "@/lib/traffic/types";

export interface TrafficFetchResult {
  enabled: boolean;
  providers: TrafficProvider[];
  segments: TrafficFlowSegment[];
  region: "india" | "global";
  message?: string;
}

/** Region-aware traffic: Mappls in India, TomTom elsewhere; both when configured in India. */
export async function fetchTrafficForBbox(bbox: TrafficBbox): Promise<TrafficFetchResult> {
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const midLon = (bbox.minLon + bbox.maxLon) / 2;
  const india = isInIndia(midLat, midLon);

  const tasks: Promise<TrafficFlowSegment[]>[] = [];
  const providers: TrafficProvider[] = [];

  if (india && mapplsTrafficEnabled()) {
    providers.push("Mappls");
    tasks.push(fetchMapplsTrafficFlow(bbox));
  }
  if (tomtomTrafficEnabled()) {
    providers.push("TomTom");
    tasks.push(fetchTomtomTrafficFlow(bbox));
  }

  if (tasks.length === 0) {
    return {
      enabled: false,
      providers: [],
      segments: [],
      region: india ? "india" : "global",
      message: india
        ? "Set MAPPLS_API_KEY (India map/traffic) and/or TOMTOM_API_KEY for live traffic."
        : "Set TOMTOM_API_KEY for live traffic outside India.",
    };
  }

  const batches = await Promise.all(tasks);
  const byId = new Map<string, TrafficFlowSegment>();
  for (const batch of batches) {
    for (const seg of batch) byId.set(`${seg.provider}:${seg.id}`, seg);
  }

  const segments = await enrichSegmentsWithRoadNames([...byId.values()]);

  return {
    enabled: true,
    providers,
    segments,
    region: india ? "india" : "global",
  };
}

export function anyTrafficEnabled(): boolean {
  return mapplsTrafficEnabled() || tomtomTrafficEnabled();
}
