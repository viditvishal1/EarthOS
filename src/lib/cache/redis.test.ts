import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
  })),
}));

describe("redis adapter", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockDel.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(async () => {
    const mod = await import("@/lib/cache/redis");
    mod.__resetRedisForTests();
  });

  it("reports not configured when env vars missing", async () => {
    const { redisConfigured, checkRedisHealth } = await import("@/lib/cache/redis");
    expect(redisConfigured()).toBe(false);
    const health = await checkRedisHealth();
    expect(health.configured).toBe(false);
    expect(health.reachable).toBe(false);
    expect(health.status).toBe("not_configured");
  });

  it("falls back to KV_* when UPSTASH_* absent", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "https://example.upstash.io");
    vi.stubEnv("KV_REST_API_TOKEN", "token");

    mockSet.mockResolvedValue("OK");
    mockGet.mockResolvedValue({ hello: "world" });
    mockDel.mockResolvedValue(1);

    const { cacheSet, cacheGet, redisCredentialScheme } = await import("@/lib/cache/redis");
    expect(redisCredentialScheme()).toBe("vercel-kv");

    const write = await cacheSet("flights:global", { hello: "world" }, 60);
    expect(write.ok).toBe(true);
    const value = await cacheGet<{ hello: string }>("flights:global");
    expect(value).toEqual({ hello: "world" });
  });

  it("uses SDK SET/GET/DEL with prefixed keys — not URL payloads", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    mockSet.mockResolvedValue("OK");
    mockGet.mockResolvedValue({ hello: "world" });
    mockDel.mockResolvedValue(1);

    const { cacheSet, cacheGet, cacheDel } = await import("@/lib/cache/redis");

    const write = await cacheSet("flights:global", { hello: "world" }, 60);
    expect(write.ok).toBe(true);
    expect(write.backend).toBe("redis");
    expect(mockSet).toHaveBeenCalledWith(
      "argus:cache:flights:global",
      { hello: "world" },
      { ex: 60 },
    );

    const value = await cacheGet<{ hello: string }>("flights:global");
    expect(value).toEqual({ hello: "world" });
    expect(mockGet).toHaveBeenCalledWith("argus:cache:flights:global");

    await cacheDel("flights:global");
    expect(mockDel).toHaveBeenCalledWith("argus:cache:flights:global");
  });

  it("returns write failure in production when Redis SET fails", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");

    mockSet.mockRejectedValue(new Error("network_error"));

    const { cacheSet } = await import("@/lib/cache/redis");
    const write = await cacheSet("ships:global", [], 60);
    expect(write.ok).toBe(false);
    expect(write.backend).toBe("none");
  });

  it("falls back to memory in development when Redis unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("NODE_ENV", "development");

    mockSet.mockRejectedValue(new Error("network_error"));
    mockGet.mockRejectedValue(new Error("network_error"));

    const { cacheSet, cacheGet, __resetRedisForTests } = await import("@/lib/cache/redis");
    const write = await cacheSet("iss:position", { lat: 1 }, 60);
    expect(write.ok).toBe(true);
    expect(write.backend).toBe("memory");

    const value = await cacheGet<{ lat: number }>("iss:position");
    expect(value).toEqual({ lat: 1 });
    __resetRedisForTests();
  });

  it("checkRedisHealth performs SET/GET/DEL probe without exposing secrets", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    mockSet.mockResolvedValue("OK");
    mockGet.mockImplementation(async (key: string) => {
      if (key.startsWith("argus:cache:health:probe:")) {
        return { ok: true, at: "2026-01-01T00:00:00.000Z" };
      }
      return null;
    });
    mockDel.mockResolvedValue(1);

    const { checkRedisHealth } = await import("@/lib/cache/redis");
    const health = await checkRedisHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(health.status).toBe("healthy");
    expect(JSON.stringify(health)).not.toContain("token");
  });
});
