// Resource usage tracking and quota level computation.

import { dbEnabled } from "@/lib/db";
import { getUsageSummary, recordUsageMetric } from "@/lib/db/platform";
import { quotaLevelFromUsage, SUPABASE_RESERVE_MB, SUPABASE_TARGET_MB } from "@/lib/storage/retention";
import { r2Enabled } from "@/lib/storage/r2";
import { redisConfigured } from "@/lib/cache/redis";
import { isFeatureEnabled } from "@/lib/platform/feature-flags";
import type { UsageSnapshot } from "@/lib/platform/types";

const g = globalThis as unknown as {
  __earthosUsage?: { apiRequests: number; connectorRequests: number; day: string };
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function localCounters(): { apiRequests: number; connectorRequests: number } {
  const day = todayKey();
  if (!g.__earthosUsage || g.__earthosUsage.day !== day) {
    g.__earthosUsage = { apiRequests: 0, connectorRequests: 0, day };
  }
  return g.__earthosUsage;
}

export async function trackApiRequest(route: string): Promise<void> {
  localCounters().apiRequests += 1;
  if (dbEnabled()) {
    await recordUsageMetric("api.requests", 1, "count", { route }).catch(() => {});
  }
}

export async function trackConnectorRequest(sourceId: string): Promise<void> {
  localCounters().connectorRequests += 1;
  if (dbEnabled()) {
    await recordUsageMetric("connector.requests", 1, "count", { source_id: sourceId }).catch(() => {});
  }
}

export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const local = localCounters();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  let dbMetrics: Record<string, number> = {};
  if (dbEnabled()) {
    try {
      dbMetrics = await getUsageSummary(since);
    } catch { /* ignore */ }
  }

  const apiRequestsToday = dbMetrics["api.requests"] ?? local.apiRequests;
  const connectorRequestsToday = dbMetrics["connector.requests"] ?? local.connectorRequests;

  // Estimate Supabase usage — real metrics require Supabase Management API
  const estimatedDbMb = (dbMetrics["supabase.estimated_mb"] ?? 0) / 1;
  const usagePct = estimatedDbMb > 0 ? (estimatedDbMb / SUPABASE_TARGET_MB) * 100 : 0;

  return {
    connectorRequestsToday,
    apiRequestsToday,
    r2Enabled: r2Enabled() && (await isFeatureEnabled("r2_archive")),
    redisEnabled: redisConfigured(),
    supabaseUsagePct: usagePct,
    quotaLevel: quotaLevelFromUsage(usagePct),
    fetchedAt: new Date().toISOString(),
  };
}

export { SUPABASE_TARGET_MB, SUPABASE_RESERVE_MB };
