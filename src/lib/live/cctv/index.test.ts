import { afterEach, describe, expect, it } from "vitest";
import { CCTV_ADAPTERS, isAdapterEnabled } from "@/lib/live/cctv";

describe("CCTV adapter registry", () => {
  afterEach(() => {
    for (const a of CCTV_ADAPTERS) delete process.env[a.envFlag];
  });

  it("enables adapters by default when env flag is unset", () => {
    for (const adapter of CCTV_ADAPTERS) {
      delete process.env[adapter.envFlag];
      expect(isAdapterEnabled(adapter)).toBe(true);
    }
  });

  it("respects CCTV_ENABLE_*=false", () => {
    const tfl = CCTV_ADAPTERS.find((a) => a.id === "tfl")!;
    process.env.CCTV_ENABLE_TFL = "false";
    expect(isAdapterEnabled(tfl)).toBe(false);
  });
});
