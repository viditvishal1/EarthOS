// Redis cache adapter — official @upstash/redis SDK (request body, not URL payloads).

import { Redis } from "@upstash/redis";
import {
  redisConfigured,
  redisCredentialScheme,
  resolveRedisCredentials,
  type RedisCredentialScheme,
} from "@/lib/cache/redis-config";

export { redisConfigured, redisCredentialScheme, resolveRedisCredentials };
export type { RedisCredentialScheme };

const KEY_PREFIX = "argus:cache:";

const g = globalThis as unknown as {
  __argusRedis?: Redis;
  __argusRedisLocal?: Map<string, { v: string; exp: number }>;
};

const local: Map<string, { v: string; exp: number }> = (g.__argusRedisLocal ??= new Map());

export type RedisHealthStatus =
  | "not_configured"
  | "healthy"
  | "unreachable";

export interface RedisHealth {
  configured: boolean;
  reachable: boolean;
  status: RedisHealthStatus;
  scheme: RedisCredentialScheme;
  latencyMs: number | null;
  lastCheckedAt: string;
  errorCategory: string | null;
  productionMode: boolean;
  usingMemoryFallback: boolean;
}

export interface CacheWriteResult {
  ok: boolean;
  backend: "redis" | "memory" | "none";
  error?: string;
}

function fullKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function getRedisClient(): Redis | null {
  const creds = resolveRedisCredentials();
  if (!redisConfigured() || !creds.url || !creds.token) return null;
  if (!g.__argusRedis) {
    g.__argusRedis = new Redis({ url: creds.url, token: creds.token });
  }
  return g.__argusRedis;
}

function allowMemoryFallback(): boolean {
  return !isProductionRuntime();
}

function logRedisError(op: string, key: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[redis] ${op} failed key=${key} error=${msg}`);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const fk = fullKey(key);
  const client = getRedisClient();

  if (client) {
    try {
      const value = await client.get<T>(fk);
      return value ?? null;
    } catch (err) {
      logRedisError("GET", key, err);
      if (!allowMemoryFallback()) return null;
    }
  }

  if (!allowMemoryFallback()) return null;

  const entry = local.get(fk);
  if (!entry || Date.now() > entry.exp) {
    local.delete(fk);
    return null;
  }
  return JSON.parse(entry.v) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<CacheWriteResult> {
  const fk = fullKey(key);
  const client = getRedisClient();

  if (client) {
    try {
      await client.set(fk, value, { ex: ttlSeconds });
      return { ok: true, backend: "redis" };
    } catch (err) {
      logRedisError("SET", key, err);
      if (!allowMemoryFallback()) {
        return { ok: false, backend: "none", error: err instanceof Error ? err.message : "redis_set_failed" };
      }
    }
  }

  if (!allowMemoryFallback()) {
    return { ok: false, backend: "none", error: "redis_not_configured" };
  }

  local.set(fk, { v: JSON.stringify(value), exp: Date.now() + ttlSeconds * 1000 });
  return { ok: true, backend: "memory" };
}

export async function cacheDel(key: string): Promise<void> {
  const fk = fullKey(key);
  local.delete(fk);
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(fk);
  } catch (err) {
    logRedisError("DEL", key, err);
  }
}

/** SET if not exists — used for distributed locks. Returns true when lock acquired. */
export async function cacheSetNx(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const fk = fullKey(key);
  const client = getRedisClient();
  if (!client) {
    if (!allowMemoryFallback()) return false;
    if (local.has(fk) && (local.get(fk)?.exp ?? 0) > Date.now()) return false;
    local.set(fk, { v: JSON.stringify(value), exp: Date.now() + ttlSeconds * 1000 });
    return true;
  }
  try {
    const result = await client.set(fk, value, { nx: true, ex: ttlSeconds });
    return result === "OK";
  } catch (err) {
    logRedisError("SETNX", key, err);
    return false;
  }
}

export async function cacheGetString(key: string): Promise<string | null> {
  const fk = fullKey(key);
  const client = getRedisClient();
  if (client) {
    try {
      const v = await client.get<string>(fk);
      return v ?? null;
    } catch (err) {
      logRedisError("GET", key, err);
      if (!allowMemoryFallback()) return null;
    }
  }
  if (!allowMemoryFallback()) return null;
  const entry = local.get(fk);
  if (!entry || Date.now() > entry.exp) return null;
  try {
    return JSON.parse(entry.v) as string;
  } catch {
    return entry.v;
  }
}

/** Safe round-trip health check — never returns credentials. */
export async function checkRedisHealth(): Promise<RedisHealth> {
  const configured = redisConfigured();
  const scheme = redisCredentialScheme();
  const lastCheckedAt = new Date().toISOString();
  const productionMode = isProductionRuntime();
  const creds = resolveRedisCredentials();

  if (!configured) {
    return {
      configured: false,
      reachable: false,
      status: "not_configured",
      scheme,
      latencyMs: null,
      lastCheckedAt,
      errorCategory: creds.configError ?? "not_configured",
      productionMode,
      usingMemoryFallback: allowMemoryFallback(),
    };
  }

  const probeKey = `health:probe:${Date.now()}`;
  const probeValue = { ok: true, at: lastCheckedAt };
  const started = Date.now();

  try {
    const write = await cacheSet(probeKey, probeValue, 30);
    if (!write.ok) {
      return {
        configured: true,
        reachable: false,
        status: "unreachable",
        scheme,
        latencyMs: Date.now() - started,
        lastCheckedAt,
        errorCategory: write.error ?? "write_failed",
        productionMode,
        usingMemoryFallback: false,
      };
    }

    const read = await cacheGet<typeof probeValue>(probeKey);
    await cacheDel(probeKey);

    if (!read?.ok) {
      return {
        configured: true,
        reachable: false,
        status: "unreachable",
        scheme,
        latencyMs: Date.now() - started,
        lastCheckedAt,
        errorCategory: "read_mismatch",
        productionMode,
        usingMemoryFallback: write.backend === "memory",
      };
    }

    return {
      configured: true,
      reachable: true,
      status: "healthy",
      scheme,
      latencyMs: Date.now() - started,
      lastCheckedAt,
      errorCategory: null,
      productionMode,
      usingMemoryFallback: write.backend === "memory",
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      status: "unreachable",
      scheme,
      latencyMs: Date.now() - started,
      lastCheckedAt,
      errorCategory: err instanceof Error ? err.message : "health_check_failed",
      productionMode,
      usingMemoryFallback: false,
    };
  }
}

/** Test helper — reset client and local cache. */
export function __resetRedisForTests(): void {
  g.__argusRedis = undefined;
  local.clear();
}
