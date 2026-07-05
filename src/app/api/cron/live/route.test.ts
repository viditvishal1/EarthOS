import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyCronBearer = vi.fn();
const checkRedisHealth = vi.fn();
const acquireLiveSeedLock = vi.fn();
const releaseLiveSeedLock = vi.fn();
const seedLiveDomains = vi.fn();

vi.mock("@/lib/auth/cron-secret", () => ({
  verifyCronBearer: (...args: unknown[]) => verifyCronBearer(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  checkRedisHealth: (...args: unknown[]) => checkRedisHealth(...args),
  isProductionRuntime: () => false,
}));

vi.mock("@/lib/live/lock", () => ({
  acquireLiveSeedLock: (...args: unknown[]) => acquireLiveSeedLock(...args),
  releaseLiveSeedLock: (...args: unknown[]) => releaseLiveSeedLock(...args),
}));

vi.mock("@/lib/live/seed-cron", () => ({
  seedLiveDomains: (...args: unknown[]) => seedLiveDomains(...args),
  legacyCountsFromDomains: () => ({
    flights: { global: 10 },
    ships: 5,
    webcams: 3,
    cctv: 42,
    iss: 1,
    modules: {},
  }),
  formatCronDomainSummaries: () => ({
    flights: { status: "success", count: 10, durationMs: 100, source: "test" },
  }),
}));

vi.mock("@/lib/live/seed-meta", () => ({
  writeSeedAttempt: vi.fn(),
}));

vi.mock("@/lib/usage/tracker", () => ({
  trackApiRequest: vi.fn(),
}));

function req(auth?: string) {
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/cron/live", { headers });
}

describe("GET /api/cron/live", () => {
  beforeEach(() => {
    verifyCronBearer.mockReset();
    checkRedisHealth.mockReset();
    acquireLiveSeedLock.mockReset();
    releaseLiveSeedLock.mockReset();
    seedLiveDomains.mockReset();

    checkRedisHealth.mockResolvedValue({
      configured: true,
      reachable: true,
      status: "healthy",
      latencyMs: 12,
      lastCheckedAt: new Date().toISOString(),
      errorCategory: null,
      productionMode: false,
      usingMemoryFallback: false,
    });
    acquireLiveSeedLock.mockResolvedValue({ acquired: true, token: "lock-token" });
    seedLiveDomains.mockResolvedValue({
      domains: [{ domain: "flights:global", status: "ok", count: 10, source: "test", durationMs: 100 }],
      durationMs: 500,
      redisWriteFailures: 0,
    });
  });

  it("returns 401 when Bearer secret is missing or invalid", async () => {
    verifyCronBearer.mockReturnValue(false);
    const { GET } = await import("@/app/api/cron/live/route");
    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("accepts valid Bearer secret and returns structured JSON", async () => {
    verifyCronBearer.mockReturnValue(true);
    const { GET } = await import("@/app/api/cron/live/route");
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.domains.flights?.status).toBe("success");
    expect(body.redis.reachable).toBe(true);
    expect(releaseLiveSeedLock).toHaveBeenCalledWith("lock-token");
  });

  it("returns 409 when distributed lock is held", async () => {
    verifyCronBearer.mockReturnValue(true);
    acquireLiveSeedLock.mockResolvedValue({ acquired: false, token: "x" });
    const { GET } = await import("@/app/api/cron/live/route");
    const res = await GET(req("Bearer test-secret"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("seed_already_running");
    expect(seedLiveDomains).not.toHaveBeenCalled();
  });
});
