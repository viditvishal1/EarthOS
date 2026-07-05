import { describe, expect, it } from "vitest";
import { buildFlightItem } from "@/lib/aviation/flight-record";

describe("buildFlightItem", () => {
  it("never fabricates origin or destination", () => {
    const item = buildFlightItem({
      icao24: "abc123",
      callsign: "UAL123",
      lat: 40,
      lon: -74,
      observedAt: "2026-07-05T12:00:00Z",
      provider: "Test",
      sourceUrl: "https://example.com",
      region: "USA",
    });
    expect(item.extra?.origin).toBeNull();
    expect(item.extra?.destination).toBeNull();
    expect(item.extra?.routeKnown).toBe(false);
    expect(item.summary).toContain("route unknown");
  });
});
