import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheSetNx = vi.fn();
const cacheGetString = vi.fn();
const cacheDel = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheSetNx: (...args: unknown[]) => cacheSetNx(...args),
  cacheGetString: (...args: unknown[]) => cacheGetString(...args),
  cacheDel: (...args: unknown[]) => cacheDel(...args),
}));

describe("live seed lock", () => {
  beforeEach(() => {
    cacheSetNx.mockReset();
    cacheGetString.mockReset();
    cacheDel.mockReset();
  });

  it("acquires lock when SETNX succeeds", async () => {
    cacheSetNx.mockResolvedValue(true);
    const { acquireLiveSeedLock } = await import("@/lib/live/lock");
    const lock = await acquireLiveSeedLock();
    expect(lock.acquired).toBe(true);
    expect(lock.token).toBeTruthy();
  });

  it("blocks concurrent seed when lock already held", async () => {
    cacheSetNx.mockResolvedValue(false);
    const { acquireLiveSeedLock } = await import("@/lib/live/lock");
    const lock = await acquireLiveSeedLock();
    expect(lock.acquired).toBe(false);
  });

  it("releases lock only when token matches", async () => {
    cacheGetString.mockResolvedValue("token-a");
    const { releaseLiveSeedLock } = await import("@/lib/live/lock");
    await releaseLiveSeedLock("token-a");
    expect(cacheDel).toHaveBeenCalled();
    cacheDel.mockClear();
    await releaseLiveSeedLock("token-b");
    expect(cacheDel).not.toHaveBeenCalled();
  });
});
