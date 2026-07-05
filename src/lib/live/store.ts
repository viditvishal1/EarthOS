// Live-layer store — seed/read split with last-known-good protection.

import { cacheGet, cacheSet, type CacheWriteResult } from "@/lib/cache/redis";
import { LIVE_HARD_TTL_SECONDS } from "@/lib/live/config";

export interface LiveEnvelope<T> {
  data: T;
  updatedAt: string;
  source: string;
}

export interface LiveResult<T> {
  data: T;
  updatedAt: string | null;
  ageSeconds: number | null;
  stale: boolean;
  source: string;
  cold: boolean;
}

export interface ReadLiveOptions<T> {
  ttlSeconds: number;
  source: string;
  fallback: T;
  coldTimeoutMs?: number;
  refreshWhenStale?: boolean;
  seedEmpty?: boolean;
  allowColdFetch?: boolean;
  isEmpty?: (data: T) => boolean;
}

const g = globalThis as unknown as { __argusLiveInflight?: Set<string> };
const inflight: Set<string> = (g.__argusLiveInflight ??= new Set());

export function defaultIsEmpty<T>(data: T): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

function envelopeFromCache<T>(env: LiveEnvelope<T>, ttlSeconds: number, source: string): LiveResult<T> {
  const ageSeconds = Math.max(0, (Date.now() - new Date(env.updatedAt).getTime()) / 1000);
  return {
    data: env.data,
    updatedAt: env.updatedAt,
    ageSeconds,
    stale: ageSeconds > ttlSeconds,
    source: env.source ?? source,
    cold: false,
  };
}

/** Redis-read-only — never fetches upstream, never refreshes, never writes. */
export async function readLiveCached<T>(
  key: string,
  opts: Pick<ReadLiveOptions<T>, "ttlSeconds" | "source" | "fallback">,
): Promise<LiveResult<T>> {
  const env = await cacheGet<LiveEnvelope<T>>(`live:${key}`).catch(() => null);
  if (env && env.data !== undefined) {
    return envelopeFromCache(env, opts.ttlSeconds, opts.source);
  }
  return {
    data: opts.fallback,
    updatedAt: null,
    ageSeconds: null,
    stale: true,
    source: opts.source,
    cold: true,
  };
}

export async function seedLiveSafe<T>(
  key: string,
  data: T,
  source: string,
  opts: { seedEmpty?: boolean; isEmpty?: (data: T) => boolean } = {},
): Promise<CacheWriteResult & { skipped?: boolean; reason?: string }> {
  const isEmpty = opts.isEmpty ?? defaultIsEmpty;
  if (!opts.seedEmpty && isEmpty(data)) {
    return { ok: false, backend: "none", skipped: true, reason: "empty_not_allowed" };
  }
  const env: LiveEnvelope<T> = { data, updatedAt: new Date().toISOString(), source };
  return cacheSet(`live:${key}`, env, LIVE_HARD_TTL_SECONDS);
}

export async function seedLive<T>(
  key: string,
  data: T,
  source: string,
): Promise<CacheWriteResult & { skipped?: boolean; reason?: string }> {
  return seedLiveSafe(key, data, source, { seedEmpty: false });
}

export async function readLive<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: ReadLiveOptions<T>,
): Promise<LiveResult<T>> {
  const {
    ttlSeconds,
    source,
    fallback,
    coldTimeoutMs = 8000,
    refreshWhenStale = true,
    seedEmpty = false,
    allowColdFetch = true,
    isEmpty = defaultIsEmpty,
  } = opts;

  const env = await cacheGet<LiveEnvelope<T>>(`live:${key}`).catch(() => null);

  if (env && env.data !== undefined) {
    const result = envelopeFromCache(env, ttlSeconds, source);
    if (result.stale && refreshWhenStale && allowColdFetch) {
      void backgroundRefresh(key, fetcher, source, { seedEmpty, isEmpty });
    }
    return result;
  }

  if (!allowColdFetch) {
    return {
      data: fallback,
      updatedAt: null,
      ageSeconds: null,
      stale: true,
      source,
      cold: true,
    };
  }

  try {
    const data = await withTimeout(fetcher(), coldTimeoutMs);
    if (!seedEmpty && isEmpty(data)) {
      return { data: fallback, updatedAt: null, ageSeconds: null, stale: true, source, cold: true };
    }
    const write = await seedLiveSafe(key, data, source, { seedEmpty, isEmpty });
    if (!write.ok && !write.skipped) {
      return { data: fallback, updatedAt: null, ageSeconds: null, stale: true, source, cold: true };
    }
    if (write.skipped) {
      return { data: fallback, updatedAt: null, ageSeconds: null, stale: true, source, cold: true };
    }
    return {
      data,
      updatedAt: new Date().toISOString(),
      ageSeconds: 0,
      stale: false,
      source,
      cold: true,
    };
  } catch {
    return { data: fallback, updatedAt: null, ageSeconds: null, stale: true, source, cold: true };
  }
}

async function backgroundRefresh<T>(
  key: string,
  fetcher: () => Promise<T>,
  source: string,
  opts: { seedEmpty: boolean; isEmpty: (data: T) => boolean },
): Promise<void> {
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    const data = await fetcher();
    await seedLiveSafe(key, data, source, opts);
  } catch {
    /* preserve last-known-good */
  } finally {
    inflight.delete(key);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
