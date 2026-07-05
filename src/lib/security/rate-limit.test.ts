import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

vi.mock("@/lib/platform/feature-flags", () => ({
  isFeatureEnabled: vi.fn(async (key: string) => key === "strict_rate_limits"),
}));

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const key = `test-${Date.now()}`;
    const cfg = { key, limit: 5, windowMs: 60_000 };
    const first = await checkRateLimit(cfg);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBeGreaterThanOrEqual(0);
  });

  it("blocks after exceeding in-memory limit when strict", async () => {
    const key = `burst-${Date.now()}`;
    const cfg = { key, limit: 2, windowMs: 60_000 };
    await checkRateLimit(cfg);
    await checkRateLimit(cfg);
    const third = await checkRateLimit(cfg);
    expect(third.allowed).toBe(false);
  });
});
