// Rate limiting — in-process sliding window with optional Redis backing.

import { isFeatureEnabled } from "@/lib/platform/feature-flags";

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __earthosRate?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__earthosRate ??= new Map());

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

async function redisIncr(key: string, windowMs: number): Promise<{ count: number; ttl: number } | null> {
  const { resolveRedisCredentials } = await import("@/lib/cache/redis-config");
  const creds = resolveRedisCredentials();
  const url = creds.url;
  const token = creds.token;
  if (!url || !token) return null;

  const redisKey = `earthos:rl:${key}`;
  try {
    const countRes = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const count = Number(await countRes.text());
    if (count === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${Math.ceil(windowMs / 1000)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    const ttlRes = await fetch(`${url}/ttl/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ttl = Number(await ttlRes.text());
    return { count, ttl: ttl > 0 ? ttl : Math.ceil(windowMs / 1000) };
  } catch {
    return null;
  }
}

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const strict = await isFeatureEnabled("strict_rate_limits");
  const effectiveLimit = strict ? config.limit : Math.max(config.limit, config.limit * 3);
  const now = Date.now();
  const redis = strict ? await redisIncr(config.key, config.windowMs) : null;

  if (redis) {
    const allowed = redis.count <= effectiveLimit;
    return {
      allowed,
      remaining: Math.max(0, effectiveLimit - redis.count),
      resetAt: now + redis.ttl * 1000,
      limit: effectiveLimit,
    };
  }

  let bucket = buckets.get(config.key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(config.key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= effectiveLimit;
  return {
    allowed,
    remaining: Math.max(0, effectiveLimit - bucket.count),
    resetAt: bucket.resetAt,
    limit: effectiveLimit,
  };
}

/** Extract client key from request (IP or forwarded header). */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  return forwarded || realIp || "anonymous";
}

export const LIMITS = {
  search: { limit: 30, windowMs: 60_000 },
  analyst: { limit: 10, windowMs: 60_000 },
  graph: { limit: 20, windowMs: 60_000 },
  article: { limit: 40, windowMs: 60_000 },
  geocode: { limit: 60, windowMs: 60_000 },
} as const;
