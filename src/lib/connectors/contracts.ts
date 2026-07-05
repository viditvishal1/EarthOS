/**
 * Provider contracts — World Monitor-style governance without copying AGPL code.
 * Connectors implement ProviderDefinition or remain on legacy ConnectorManifest during migration.
 */

import type { ContentPolicy, Item } from "@/lib/types";

export type ProviderCost = "open" | "free-limited" | "freemium" | "paid" | "self-hosted";
export type SecretClass = "none" | "public-client" | "server-secret" | "internal-service";
export type ProviderDefaultPolicy = "default" | "opt-in" | "fallback" | "off";

export type DataFreshnessState =
  | "fresh"
  | "stale"
  | "unavailable"
  | "key-required"
  | "rate-limited"
  | "not-covered";

export interface ProviderFetchContext {
  fetchedAt: string;
  signal?: AbortSignal;
  bbox?: [number, number, number, number];
  etag?: string | null;
}

export interface ProviderBatch<T> {
  records: T[];
  etag?: string;
  retryAfterSeconds?: number;
  partial?: boolean;
}

export interface NormalizeContext {
  providerId: string;
  fetchedAt: string;
  licensePolicy: ContentPolicy;
  attribution: string;
}

export interface NormalizedProvenance {
  providerId: string;
  sourceRecordId: string;
  observedAt: string;
  publishedAt?: string;
  fetchedAt: string;
  schemaVersion: string;
  rawHash?: string;
  licensePolicy: ContentPolicy;
  attribution: string;
  qualityFlags: string[];
}

/** Extended observation envelope — Item remains the UI compatibility layer. */
export interface NormalizedObservation extends Item {
  provenance: NormalizedProvenance;
}

export interface ProviderDefinition<T = unknown> {
  id: string;
  domains: string[];
  cost: ProviderCost;
  secretClass: SecretClass;
  requiredEnv: string[];
  optionalEnv?: string[];
  defaultEnabled: boolean;
  defaultPolicy: ProviderDefaultPolicy;
  scheduleSeconds: number;
  contentPolicy: ContentPolicy;
  attribution: string;
  licenseUrl: string;
  docsUrl: string;
  coverage: string;
  /** Legacy connector id when bridged from ConnectorManifest. */
  legacyConnectorId?: string;
  validate?(input: unknown): T;
  fetch?(ctx: ProviderFetchContext): Promise<ProviderBatch<T>>;
  normalize?(record: T, ctx: NormalizeContext): NormalizedObservation[];
}

export interface ProviderHealthSnapshot {
  id: string;
  state: DataFreshnessState;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  recordCount: number;
  quotaHint?: string;
}

export function itemToObservation(item: Item, provenance: Partial<NormalizedProvenance>): NormalizedObservation {
  const now = new Date().toISOString();
  return {
    ...item,
    provenance: {
      providerId: provenance.providerId ?? item.connectorId,
      sourceRecordId: provenance.sourceRecordId ?? item.id,
      observedAt: provenance.observedAt ?? item.timestamp,
      publishedAt: provenance.publishedAt,
      fetchedAt: provenance.fetchedAt ?? now,
      schemaVersion: provenance.schemaVersion ?? "1",
      rawHash: provenance.rawHash,
      licensePolicy: provenance.licensePolicy ?? item.contentPolicy,
      attribution: provenance.attribution ?? item.source,
      qualityFlags: provenance.qualityFlags ?? [],
    },
  };
}
