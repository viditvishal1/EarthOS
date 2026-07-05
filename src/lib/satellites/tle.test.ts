import { describe, expect, it } from "vitest";
import {
  parseTleText,
  predictPasses,
  propagatePosition,
} from "@/lib/satellites/tle";

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24188.51782528  .00016717  00000+0  10270-3 0  9029
2 25544  51.6416 247.4627 0006703  86.6752 273.4523 15.49501592 45601`;

describe("satellite TLE propagation", () => {
  it("parses CelesTrak TLE blocks", () => {
    const parsed = parseTleText(ISS_TLE, 5);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].noradId).toBe("25544");
    expect(parsed[0].name).toContain("ISS");
  });

  it("propagates a position without upstream API", () => {
    const parsed = parseTleText(ISS_TLE, 1);
    const pos = propagatePosition(parsed[0]);
    expect(pos).not.toBeNull();
    expect(typeof pos!.lat).toBe("number");
    expect(typeof pos!.lng).toBe("number");
    expect(pos!.altKm).toBeGreaterThan(200);
  });

  it("predicts passes for an observer", () => {
    const parsed = parseTleText(ISS_TLE, 1);
    const passes = predictPasses(parsed[0], 51.5, -0.12, 24, 5);
    expect(Array.isArray(passes)).toBe(true);
  });
});
