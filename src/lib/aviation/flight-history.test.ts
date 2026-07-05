import { describe, expect, it } from "vitest";
import { appendFlightHistory } from "@/lib/aviation/flight-history";

describe("appendFlightHistory", () => {
  it("stores and dedupes nearby points", async () => {
    const p = { lat: 40.7, lon: -74.0, observedAt: "2026-07-05T12:00:00Z" };
    const first = await appendFlightHistory("abc123", p);
    expect(first).toHaveLength(1);
    const second = await appendFlightHistory("abc123", { ...p, observedAt: "2026-07-05T12:00:05Z" });
    expect(second).toHaveLength(1);
    const third = await appendFlightHistory("abc123", { lat: 41, lon: -73, observedAt: "2026-07-05T12:01:00Z" });
    expect(third).toHaveLength(2);
  });
});
