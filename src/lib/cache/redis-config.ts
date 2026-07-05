/** Server-only Redis credential resolution — supports UPSTASH_* and Vercel KV_* names. */

export type RedisCredentialScheme = "upstash" | "vercel-kv" | "unconfigured";

export interface ResolvedRedisCredentials {
  scheme: RedisCredentialScheme;
  url: string | null;
  token: string | null;
  /** Non-secret configuration problem, e.g. URL without write token. */
  configError: string | null;
}

export function resolveRedisCredentials(): ResolvedRedisCredentials {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || null;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null;
  const kvUrl = process.env.KV_REST_API_URL?.trim() || null;
  const kvToken = process.env.KV_REST_API_TOKEN?.trim() || null;

  if (upstashUrl && upstashToken) {
    return { scheme: "upstash", url: upstashUrl, token: upstashToken, configError: null };
  }
  if (upstashUrl && !upstashToken) {
    return { scheme: "unconfigured", url: upstashUrl, token: null, configError: "missing_write_token" };
  }

  if (kvUrl && kvToken) {
    return { scheme: "vercel-kv", url: kvUrl, token: kvToken, configError: null };
  }
  if (kvUrl && !kvToken) {
    return { scheme: "unconfigured", url: kvUrl, token: null, configError: "missing_write_token" };
  }

  return { scheme: "unconfigured", url: null, token: null, configError: "not_configured" };
}

export function redisConfigured(): boolean {
  const c = resolveRedisCredentials();
  return c.configError == null && c.url != null && c.token != null;
}

export function redisCredentialScheme(): RedisCredentialScheme {
  return resolveRedisCredentials().scheme;
}
