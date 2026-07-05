import { describe, expect, it } from "vitest";
import { computeCiiV1 } from "@/lib/intelligence/cii/v1";
import type { Item } from "@/lib/types";

const base: Omit<Item, "id" | "title" | "module" | "tags" | "severity"> = {
  connectorId: "test",
  source: "test",
  timestamp: new Date().toISOString(),
  entities: [],
  contentPolicy: "metadata_only",
};

describe("computeCiiV1", () => {
  it("returns insufficient_data when no evidence", () => {
    const snap = computeCiiV1("UA", []);
    expect(snap.band).toBe("insufficient_data");
    expect(snap.coverageState).toBe("insufficient");
  });

  it("scores higher with conflict evidence in country bbox", () => {
    const items: Item[] = [
      {
        ...base,
        id: "1",
        module: "conflict",
        title: "Event Kyiv",
        tags: ["conflict"],
        severity: 8,
        lat: 50.45,
        lon: 30.52,
      },
      {
        ...base,
        id: "2",
        module: "earth",
        title: "Quake",
        tags: ["earthquake"],
        severity: 6,
        lat: 49,
        lon: 31,
      },
    ];
    const snap = computeCiiV1("UA", items);
    expect(snap.score).toBeGreaterThan(20);
    expect(snap.components.find((c) => c.id === "conflict")?.evidenceCount).toBe(1);
  });

  it("golden vector: low activity US", () => {
    const snap = computeCiiV1("US", []);
    expect(snap.iso2).toBe("US");
    expect(snap.methodologyVersion).toBe("cii-v1");
  });
});
