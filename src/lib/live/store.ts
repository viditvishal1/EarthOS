// Live-layer store — the seed/read split that keeps upstream calls off the
// request path. Readers call readLive(); it returns the last-known-good value
// from Redis (shared across serverless instances via Upstash, surviving cold
// starts) and never blocks on an upstream fetch when a cached value exists.
//
// Refresh happens via stale-while-revalidate: if the cached value is older
// than its TTL, a single de-duplicated background refresh is kicked off while
// the current (stale) value is returned immediately. A cron/worker can also
// call seedLive() directly to keep keys warm.

import { cacheGet, cacheSet } from "@/lib/cache/redis";

export interface LiveEnvelope<T> {
  data: T;
  updatedAt: string; // ISO of the successful upstream fetch
  source: string;
}

export interface LiveResult<T> {
  data: T;
  updatedAt: string | null;
  ageSeconds: number | null;
  stale: boolean;
  source: string;
  cold: boolean; // true when no cached value existed and we had to fetch inline
}

// De-dupe concurrent background refreshes per key within an instance.
const g = globalThis as unknown as { __argusLiveInflight?: Set<string> };
const inflight: Set<string> = (g.__argusLiveInflight ??= new Set());

/** Persist a freshly-fetched value as the last-known-good for `key`. */
export async function seedLive<T>(key: string, data: T, source: string): Promise<void> {
  const env: LiveEnvelope<T> = { data, updatedAt: new Date().toISOString(), source };
  // 24h hard TTL — the envelope carries its own freshness for the stale flag,
  // so a value older than the soft TTL is still returned (better than empty).
  await cacheSet(`live:${key}`, env, 86_400).catch(() => {});
}

/**
 * Read the last-known-good value for `key`. Never blocks on an upstream call
 * when a cached value exists. When the value is older than `ttlSeconds`, a
 * single background refresh is triggered (fire-and-forget). Only when nothing
 * is cached at all does it await `fetcher` inline, bounded by `coldTimeoutMs`.
 */
export async function readLive<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds: number; source: string; fallback: T; coldTimeoutMs?: number },
): Promise<LiveResult<T>> {
  const { ttlSeconds, source, fallback, coldTimeoutMs = 8000 } = opts;
  const env = await cacheGet<LiveEnvelope<T>>(`live:${key}`).catch(() => null);

  if (env && env.data !== undefined) {
    const ageSeconds = Math.max(0, (Date.now() - new Date(env.updatedAt).getTime()) / 1000);
    const stale = ageSeconds > ttlSeconds;
    if (stale) void backgroundRefresh(key, fetcher, source);
    return { data: env.data, updatedAt: env.updatedAt, ageSeconds, stale, source: env.source ?? source, cold: false };
  }

  // Cold: nothing cached. Fetch once, bounded, so the request can't hang.
  try {
    const data = await withTimeout(fetcher(), coldTimeoutMs);
    await seedLive(key, data, source);
    return { data, updatedAt: new Date().toISOString(), ageSeconds: 0, stale: false, source, cold: true };
  } catch {
    return { data: fallback, updatedAt: null, ageSeconds: null, stale: true, source, cold: true };
  }
}

async function backgroundRefresh<T>(key: string, fetcher: () => Promise<T>, source: string): Promise<void> {
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    const data = await fetcher();
    await seedLive(key, data, source);
  } catch {
    /* keep last-known-good */
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
