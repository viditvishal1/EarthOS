import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheGet = vi.fn();
const cacheSet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => cacheGet(...args),
  cacheSet: (...args: unknown[]) => cacheSet(...args),
}));

describe("readLive store", () => {
  beforeEach(() => {
    cacheGet.mockReset();
    cacheSet.mockReset();
    cacheSet.mockResolvedValue({ ok: true, backend: "redis" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached data immediately without calling fetcher", async () => {
    const { readLive } = await import("@/lib/live/store");
    const updatedAt = new Date(Date.now() - 30_000).toISOString();
    cacheGet.mockResolvedValue({
      data: [{ id: "f1" }],
      updatedAt,
      source: "test",
    });

    const fetcher = vi.fn().mockResolvedValue([]);
    const result = await readLive("flights:global", fetcher, {
      ttlSeconds: 180,
      source: "test",
      fallback: [],
      refreshWhenStale: false,
    });

    expect(result.data).toEqual([{ id: "f1" }]);
    expect(result.cold).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not refresh stale cache when refreshWhenStale is false", async () => {
    const { readLive } = await import("@/lib/live/store");
    const updatedAt = new Date(Date.now() - 600_000).toISOString();
    cacheGet.mockResolvedValue({
      data: [{ id: "ship1" }],
      updatedAt,
      source: "AISHub",
    });

    const fetcher = vi.fn().mockResolvedValue([]);
    const result = await readLive("ships:global", fetcher, {
      ttlSeconds: 180,
      source: "AISHub",
      fallback: [],
      refreshWhenStale: false,
    });

    expect(result.stale).toBe(true);
    expect(result.data).toEqual([{ id: "ship1" }]);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("readLiveCached never writes on cold miss", async () => {
    const { readLiveCached } = await import("@/lib/live/store");
    cacheGet.mockResolvedValue(null);

    const result = await readLiveCached("flights:global", {
      ttlSeconds: 180,
      source: "test",
      fallback: [],
    });

    expect(result.cold).toBe(true);
    expect(result.data).toEqual([]);
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("does not seed empty flight arrays on cold fetch failure", async () => {
    const { readLive } = await import("@/lib/live/store");
    cacheGet.mockResolvedValue(null);

    const fetcher = vi.fn().mockRejectedValue(new Error("rate_limited"));
    const result = await readLive("flights:global", fetcher, {
      ttlSeconds: 180,
      source: "test",
      fallback: [],
      seedEmpty: false,
      allowColdFetch: true,
    });

    expect(result.cold).toBe(true);
    expect(result.data).toEqual([]);
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("preserves last-known-good when fetch returns empty and seedEmpty is false", async () => {
    const { readLive, seedLiveSafe } = await import("@/lib/live/store");
    cacheGet.mockResolvedValue(null);

    const fetcher = vi.fn().mockResolvedValue([]);
    const result = await readLive("flights:global", fetcher, {
      ttlSeconds: 180,
      source: "test",
      fallback: [{ id: "cached-fallback" }],
      seedEmpty: false,
      allowColdFetch: true,
    });

    expect(result.data).toEqual([{ id: "cached-fallback" }]);
    expect(cacheSet).not.toHaveBeenCalled();

    const seed = await seedLiveSafe("flights:global", [], "test");
    expect(seed.skipped).toBe(true);
    expect(seed.ok).toBe(false);
  });

  it("seedLiveSafe writes non-empty flight data", async () => {
    const { seedLiveSafe } = await import("@/lib/live/store");
    const write = await seedLiveSafe("flights:global", [{ id: "a1" }], "test");
    expect(write.ok).toBe(true);
    expect(cacheSet).toHaveBeenCalled();
  });
});
