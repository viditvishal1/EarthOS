// Redis cache adapter — Upstash REST with in-process fallback.

import { isFeatureEnabled } from "@/lib/platform/feature-flags";

const g = globalThis as unknown as { __earthosRedisLocal?: Map<string, { v: string; exp: number }> };
const local: Map<string, { v: string; exp: number }> = (g.__earthosRedisLocal ??= new Map());

async function redisEnabled(): Promise<boolean> {
  return (
    (await isFeatureEnabled("redis_cache")) &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const fullKey = `earthos:cache:${key}`;

  if (await redisEnabled()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(`${url}/get/${encodeURIComponent(fullKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw = await res.text();
      if (!raw || raw === "null") return null;
      // Upstash REST wraps the value: {"result":"<serialized>"} — unwrap first.
      const wrapper = JSON.parse(raw) as { result?: string | null };
      if (wrapper.result == null) return null;
      return JSON.parse(wrapper.result) as T;
    } catch {
      /* fall through */
    }
  }

  const entry = local.get(fullKey);
  if (!entry || Date.now() > entry.exp) {
    local.delete(fullKey);
    return null;
  }
  return JSON.parse(entry.v) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const fullKey = `earthos:cache:${key}`;
  const serialized = JSON.stringify(value);

  if (await redisEnabled()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      await fetch(`${url}/set/${encodeURIComponent(fullKey)}/${encodeURIComponent(serialized)}?EX=${ttlSeconds}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      return;
    } catch {
      /* fall through */
    }
  }

  local.set(fullKey, { v: serialized, exp: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  const fullKey = `earthos:cache:${key}`;
  local.delete(fullKey);
  if (await redisEnabled()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      await fetch(`${url}/del/${encodeURIComponent(fullKey)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  }
}
