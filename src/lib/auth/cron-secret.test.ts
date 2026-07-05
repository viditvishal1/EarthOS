import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCronBearer } from "@/lib/auth/cron-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyCronBearer", () => {
  it("rejects missing authorization when secret is configured", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyCronBearer(null)).toBe(false);
    expect(verifyCronBearer("Bearer wrong")).toBe(false);
  });

  it("accepts correct Bearer secret with constant-time comparison", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyCronBearer("Bearer test-secret-value")).toBe(true);
  });

  it("rejects incorrect length without leaking timing details", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-value");
    expect(verifyCronBearer("Bearer short")).toBe(false);
  });

  it("allows unauthenticated access in development when secret unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("ARGUS_ADMIN_SECRET", "");
    vi.stubEnv("EARTHOS_ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyCronBearer(null)).toBe(true);
  });

  it("allows unauthenticated access in test when secret unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(verifyCronBearer(null)).toBe(true);
  });
});
