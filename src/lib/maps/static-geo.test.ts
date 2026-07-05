import { describe, expect, it } from "vitest";
import { STATIC_GEO_POINTS, pointsByCategory, HUB_AIRPORT_COORDS } from "./static-geo";

describe("static geo", () => {
  it("has points across all categories", () => {
    expect(STATIC_GEO_POINTS.length).toBeGreaterThan(60);
    expect(pointsByCategory("nuclear").length).toBeGreaterThan(5);
    expect(pointsByCategory("chokepoints").length).toBeGreaterThan(5);
  });

  it("maps hub airports", () => {
    expect(HUB_AIRPORT_COORDS.KJFK?.lat).toBeCloseTo(40.641, 1);
  });
});
