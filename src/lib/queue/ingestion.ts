// Ingestion queue — decouples collectors from API requests; writes provenance records.

import { archiveRawBatch, contentHash } from "@/lib/storage/r2";
import { computeExpiresAt } from "@/lib/storage/retention";
import { recordUsageMetric, recordIngestion } from "@/lib/db/platform";
import { syncItemOntology } from "@/lib/ontology/store";
import { publish } from "@/lib/events/bus";
import { evaluateAlerts } from "@/lib/alerts/engine";
import type { Item } from "@/lib/types";

export interface IngestionJob {
  id: string;
  sourceId: string;
  provider: string;
  items: Item[];
  enqueuedAt: string;
}

const g = globalThis as unknown as { __earthosQueue?: IngestionJob[] };
const queue: IngestionJob[] = (g.__earthosQueue ??= []);

let processing = false;

export function enqueueIngestion(job: Omit<IngestionJob, "enqueuedAt">): void {
  queue.push({ ...job, enqueuedAt: new Date().toISOString() });
  void processQueue();
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      await processJob(job);
    }
  } finally {
    processing = false;
  }
}

async function processJob(job: IngestionJob): Promise<void> {
  const hash = contentHash(job.items);
  const expiresAt = computeExpiresAt("normalized");

  const archive = await archiveRawBatch({
    sourceId: job.sourceId,
    provider: job.provider,
    records: job.items,
    observedAt: new Date().toISOString(),
  });

  for (const item of job.items) {
    await syncItemOntology(item).catch(() => {});
  }

  await recordIngestion({
    id: job.id,
    sourceId: job.sourceId,
    provider: job.provider,
    contentHash: hash,
    rawObjectKey: archive.objectKey,
    itemCount: job.items.length,
    expiresAt: expiresAt.toISOString(),
  });

  await publish({
    type: "ingest.received",
    connectorId: job.sourceId,
    itemCount: job.items.length,
    meta: {
      jobId: job.id,
      contentHash: hash,
      rawObjectKey: archive.objectKey,
      expiresAt: expiresAt.toISOString(),
    },
  });

  await recordUsageMetric("ingestion.records", job.items.length, "count", { source_id: job.sourceId });
  if (archive.bytes) {
    await recordUsageMetric("ingestion.bytes", archive.bytes, "bytes", { source_id: job.sourceId });
  }

  void evaluateAlerts(job.items).catch(() => {});
}

export function queueDepth(): number {
  return queue.length;
}
