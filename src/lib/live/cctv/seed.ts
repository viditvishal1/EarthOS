import {
  CCTV_ADAPTERS,
  cctvAggregateDomain,
  cctvDomainKey,
  fetchAllCctvCameras,
  isAdapterEnabled,
  type CctvCamera,
} from "@/lib/live/cctv";
import { readLiveCached, seedLiveSafe } from "@/lib/live/store";
import { writeSeedMeta } from "@/lib/live/seed-meta";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import type { DomainSeedResult } from "@/lib/live/seed-cron";

function sanitizeError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: "fetch_failed", message: message.slice(0, 200) };
}

export async function seedCctvSource(adapterId: (typeof CCTV_ADAPTERS)[number]["id"]): Promise<DomainSeedResult> {
  const adapter = CCTV_ADAPTERS.find((a) => a.id === adapterId)!;
  const domain = cctvDomainKey(adapterId);
  const started = Date.now();

  if (!isAdapterEnabled(adapter)) {
    return {
      domain,
      status: "skipped",
      count: 0,
      source: adapter.sourceLabel,
      durationMs: Date.now() - started,
      errorCode: "disabled",
      errorMessage: `${adapter.envFlag} is disabled`,
    };
  }

  try {
    const cameras = await adapter.fetch();
    if (cameras.length === 0) {
      const cached = await readLiveCached<CctvCamera[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.cctv,
        source: adapter.sourceLabel,
        fallback: [],
      });
      if (cached.data.length > 0) {
        return {
          domain,
          status: "preserved",
          count: cached.data.length,
          source: cached.source,
          durationMs: Date.now() - started,
          errorCode: "empty_fetch",
          errorMessage: "Upstream returned zero cameras; kept last-known-good",
        };
      }
      return {
        domain,
        status: "skipped",
        count: 0,
        source: adapter.sourceLabel,
        durationMs: Date.now() - started,
        errorCode: "empty_fetch",
        errorMessage: "No cameras returned (missing optional API key?)",
      };
    }

    const write = await seedLiveSafe(domain, cameras, adapter.sourceLabel);
    if (!write.ok) {
      const cached = await readLiveCached<CctvCamera[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.cctv,
        source: adapter.sourceLabel,
        fallback: [],
      });
      return {
        domain,
        status: cached.data.length > 0 ? "preserved" : "error",
        count: cached.data.length,
        source: adapter.sourceLabel,
        durationMs: Date.now() - started,
        errorCode: "redis_write_failed",
        errorMessage: write.error ?? "Redis write failed",
      };
    }

    await writeSeedMeta(domain, cameras.length, adapter.sourceLabel);
    return {
      domain,
      status: "ok",
      count: cameras.length,
      source: adapter.sourceLabel,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    const cached = await readLiveCached<CctvCamera[]>(domain, {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source: adapter.sourceLabel,
      fallback: [],
    });
    return {
      domain,
      status: cached.data.length > 0 ? "preserved" : "error",
      count: cached.data.length,
      source: cached.source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

/** Seed all enabled CCTV sources + aggregated cctv:all bundle. */
export async function seedAllCctv(): Promise<DomainSeedResult[]> {
  const results: DomainSeedResult[] = [];

  for (const adapter of CCTV_ADAPTERS) {
    results.push(await seedCctvSource(adapter.id));
  }

  const all = await fetchAllCctvCameras();
  const domain = cctvAggregateDomain();
  const started = Date.now();
  const source = "TfL/WSDOT/Caltrans/NYC/VicRoads";

  if (all.length > 0) {
    const write = await seedLiveSafe(domain, all, source);
    if (write.ok) await writeSeedMeta(domain, all.length, source);
    results.push({
      domain,
      status: write.ok ? "ok" : "error",
      count: all.length,
      source,
      durationMs: Date.now() - started,
      errorCode: write.ok ? undefined : "redis_write_failed",
    });
  } else {
    const cached = await readLiveCached<CctvCamera[]>(domain, {
      ttlSeconds: LIVE_SOFT_TTL.cctv,
      source,
      fallback: [],
    });
    results.push({
      domain,
      status: cached.data.length > 0 ? "preserved" : "skipped",
      count: cached.data.length,
      source,
      durationMs: Date.now() - started,
    });
  }

  return results;
}

export async function readAllCctvCached(): Promise<CctvCamera[]> {
  const agg = await readLiveCached<CctvCamera[]>(cctvAggregateDomain(), {
    ttlSeconds: LIVE_SOFT_TTL.cctv,
    source: "TfL/WSDOT/Caltrans/NYC/VicRoads",
    fallback: [],
  });
  if (agg.data.length > 0) return agg.data;

  const { CCTV_SOURCES } = await import("@/lib/live/cctv");
  const parts = await Promise.all(
    CCTV_SOURCES.map((s) =>
      readLiveCached<CctvCamera[]>(cctvDomainKey(s), {
        ttlSeconds: LIVE_SOFT_TTL.cctv,
        source: s,
        fallback: [],
      }),
    ),
  );
  return parts.flatMap((p) => p.data);
}
