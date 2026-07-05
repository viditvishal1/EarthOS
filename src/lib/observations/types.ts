import type { ContentPolicy, EntityType } from "@/lib/types";

export type ObservationCategory =
  | "news"
  | "conflict"
  | "earthquake"
  | "fire"
  | "aviation"
  | "maritime"
  | "cyber"
  | "macro"
  | "other";

export interface ObservationProvenance {
  providerId: string;
  sourceRecordId: string;
  observedAt: string;
  fetchedAt: string;
  licensePolicy: ContentPolicy;
  attribution: string;
  geocodeMethod?: "explicit" | "inferred" | "none";
  geocodeConfidence?: number;
}

export interface Observation {
  id: string;
  category: ObservationCategory;
  title: string;
  summary?: string;
  url?: string;
  severity?: number;
  lat?: number;
  lng?: number;
  region?: string;
  tags: string[];
  entities: { name: string; type: EntityType }[];
  provenance: ObservationProvenance;
  clusterId?: string;
}

export interface ObservationCluster {
  id: string;
  canonicalTitle: string;
  memberCount: number;
  sources: string[];
  latestAt: string;
  observations: Observation[];
  centroid?: { lat: number; lng: number };
}
