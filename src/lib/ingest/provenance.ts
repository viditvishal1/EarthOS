import { createHash } from "crypto";

export function rawPayloadHash(payload: string | Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function buildProvenanceFields(input: {
  providerId: string;
  sourceRecordId: string;
  observedAt: string;
  publishedAt?: string;
  fetchedAt?: string;
  schemaVersion?: string;
  rawPayload?: string | Buffer;
  licensePolicy: "full_cache" | "excerpt_only" | "metadata_only";
  attribution: string;
  qualityFlags?: string[];
}) {
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  return {
    providerId: input.providerId,
    sourceRecordId: input.sourceRecordId,
    observedAt: input.observedAt,
    publishedAt: input.publishedAt,
    fetchedAt,
    validFrom: input.observedAt,
    validTo: null as string | null,
    expiresAt: null as string | null,
    schemaVersion: input.schemaVersion ?? "1",
    rawHash: input.rawPayload ? rawPayloadHash(input.rawPayload) : undefined,
    licensePolicy: input.licensePolicy,
    attribution: input.attribution,
    qualityFlags: input.qualityFlags ?? [],
  };
}
