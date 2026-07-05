import { describe, expect, it } from "vitest";
import { sloState } from "@/lib/observability/slo";

describe("sloState", () => {
  it("classifies freshness", () => {
    expect(sloState(60, 180)).toBe("fresh");
    expect(sloState(300, 180)).toBe("stale");
    expect(sloState(null, 180)).toBe("missing");
  });
});
