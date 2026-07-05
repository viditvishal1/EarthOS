// Shared domain types used across connectors, the graph, and the UI.

export type ContentPolicy = "full_cache" | "excerpt_only" | "metadata_only";

export type EntityType =
  | "organization"
  | "person"
  | "location"
  | "event"
  | "technology"
  | "repository"
  | "vessel"
  | "aircraft"
  | "satellite"
  | "instrument";

export type EdgeType =
  | "mentions"
  | "located_in"
  | "affiliated_with"
  | "affected_by"
  | "references"
  | "owns"
  | "operates"
  | "impacts";

export interface ConnectorManifest {
  id: string;
  module: string;
  source: string;
  sourceUrl: string;
  scheduleSeconds: number; // revalidation cadence
  contentPolicy: ContentPolicy;
  entityTypes: EntityType[];
  requiresKey?: string; // env var name if the source is key-gated
}

/**
 * The normalized record every connector emits. Every list in the UI is a
 * list of Items, which is what lets the universal filter bar, reader pane
 * and entity chips be shared code instead of per-module reimplementations.
 */
export interface Item {
  id: string;
  module: string;
  connectorId: string;
  title: string;
  summary?: string;
  body?: string; // full text where content_policy allows
  url?: string; // original source (secondary action only)
  source: string;
  timestamp: string; // ISO
  lat?: number;
  lon?: number;
  severity?: number; // 0-10 normalized (CVSS, magnitude, k-index...)
  severityLabel?: string;
  tags: string[];
  entities: { name: string; type: EntityType }[];
  region?: string;
  contentPolicy: ContentPolicy;
  extra?: Record<string, unknown>;
}

export interface GraphEntity {
  id: string;
  name: string;
  type: EntityType;
  degree: number;
  modules: string[];
  firstSeen: string;
  lastSeen: string;
}

/** A citable observation supporting an edge. */
export interface EdgeEvidence {
  itemId: string;
  passage: string; // the text the relationship was observed in
  source: string;
  observedAt: string; // ISO
}

export interface GraphEdge {
  id: string;
  source: string; // entity id
  target: string; // entity id
  type: EdgeType;
  itemIds: string[];
  weight: number;
  confidence?: number;
  resolutionMethod?: "inferred" | "confirmed" | "manual";
  /** fact = stated in a source; inference = co-occurrence or model-derived. */
  kind?: "fact" | "inference" | "prediction";
  evidence?: EdgeEvidence[];
}

export type ConnectorHealthState =
  | "unknown"
  | "healthy"
  | "degraded"
  | "error"
  | "key_gated"
  | "disabled"
  | "rate_limited";

export interface ConnectorStatus {
  id: string;
  module: string;
  source: string;
  ok: boolean;
  health: ConnectorHealthState;
  keyGated: boolean;
  lastFetch?: string;
  lastError?: string;
  itemCount: number;
  latencyMs?: number;
  geographicScope?: string;
  dataDelay?: string;
  provider?: string;
  stale?: boolean;
}
