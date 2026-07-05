import { describe, expect, it } from "vitest";
import {
  congestionLabel,
  congestionLevel,
  lineColorForRatio,
  speedRatio,
  trafficCardTitle,
} from "@/lib/traffic/labels";

describe("traffic labels", () => {
  it("classifies standstill below 0.3 ratio", () => {
    expect(congestionLevel(0.2)).toBe("standstill");
    expect(congestionLabel("standstill")).toContain("signal");
  });

  it("colors heavy congestion red", () => {
    expect(lineColorForRatio(0.4)).toBe("#ef4444");
  });

  it("formats card title with road name", () => {
    const title = trafficCardTitle({
      id: "t1",
      provider: "TomTom",
      roadName: "Nelson Mandela Road",
      lat: 28.6,
      lon: 77.2,
      currentSpeed: 20,
      freeFlowSpeed: 45,
      confidence: 0.8,
      coords: [[77.2, 28.6], [77.21, 28.61]],
    });
    expect(title).toContain("Heavy traffic");
    expect(title).toContain("Nelson Mandela Road");
    expect(speedRatio({ currentSpeed: 20, freeFlowSpeed: 45 })).toBeCloseTo(0.44, 1);
  });
});
