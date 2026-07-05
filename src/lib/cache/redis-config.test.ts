import { describe, expect, it, vi } from "vitest";
import { resolveRedisCredentials, redisConfigured } from "@/lib/cache/redis-config";

describe("redis-config", () => {
  it("prefers UPSTASH_* over KV_*", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "upstash-token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");

    const creds = resolveRedisCredentials();
    expect(creds.scheme).toBe("upstash");
    expect(creds.url).toBe("https://upstash.example");
    expect(creds.token).toBe("upstash-token");
    expect(redisConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("falls back to KV_* when UPSTASH_* absent", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");

    const creds = resolveRedisCredentials();
    expect(creds.scheme).toBe("vercel-kv");
    expect(redisConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns unconfigured when URL exists without write token", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "");

    const creds = resolveRedisCredentials();
    expect(creds.scheme).toBe("unconfigured");
    expect(creds.configError).toBe("missing_write_token");
    expect(redisConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("falls through to KV when UPSTASH URL is an encrypted blob", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "eyJinvalid-encrypted-blob");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "kv-token");

    const creds = resolveRedisCredentials();
    expect(creds.scheme).toBe("vercel-kv");
    vi.unstubAllEnvs();
  });

  it("never uses read-only KV token", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("KV_REST_API_READ_ONLY_TOKEN", "read-only");

    const creds = resolveRedisCredentials();
    expect(creds.token).not.toBe("read-only");
    expect(redisConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });
});
