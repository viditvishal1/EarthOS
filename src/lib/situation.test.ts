import { describe, expect, it } from "vitest";
import { computeSituations } from "./situation";
import type { Item } from "./types";

const NOW = Date.parse("2026-07-05T12:00:00Z");

function item(partial: Partial<Item> & { module: string; region?: string }): Item {
  return {
    id: `${partial.module}:${Math.random()}`,
    connectorId: `${partial.module}_test`,
    title: "test item",
    source: "Test",
    timestamp: new Date(NOW - 3_600_000).toISOString(),
    tags: [],
    entities: [],
    contentPolicy: "full_cache",
    ...partial,
  } as Item;
}

describe("computeSituations", () => {
  it("scores multi-module convergence above single-module volume", () => {
    const items = [
      // Ukraine: 3 modules, moderate severity
      item({ module: "news", region: "Ukraine", severity: 3 }),
      item({ module: "conflict", region: "Ukraine", severity: 5 }),
      item({ module: "earth", region: "Ukraine", severity: 2 }),
      // Japan: 1 module but many severe quake items
      ...Array.from({ length: 8 }, () => item({ module: "earth", region: "Japan", severity: 6.5 })),
    ];
    const result = computeSituations(items, { now: NOW });
    expect(result[0].region).toBe("Ukraine");
    expect(result[0].modules).toEqual(["conflict", "earth", "news"]);
  });

  it("drops single-module regions below the severity floor", () => {
    const items = [
      item({ module: "news", region: "France", severity: 1 }),
      item({ module: "news", region: "France", severity: 2 }),
    ];
    expect(computeSituations(items, { now: NOW })).toHaveLength(0);
  });

  it("keeps single-module regions with a severe signal", () => {
    const items = [item({ module: "earth", region: "Chile", severity: 7.8 })];
    const result = computeSituations(items, { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].maxSeverity).toBe(7.8);
  });

  it("ignores generic and missing regions", () => {
    const items = [
      item({ module: "news", region: "Global", severity: 9 }),
      item({ module: "cyber", severity: 9 }),
    ];
    expect(computeSituations(items, { now: NOW })).toHaveLength(0);
  });

  it("decays stale situations toward zero", () => {
    const old = new Date(NOW - 80 * 3_600_000).toISOString();
    const items = [
      item({ module: "news", region: "Peru", severity: 8, timestamp: old }),
      item({ module: "earth", region: "Peru", severity: 8, timestamp: old }),
    ];
    expect(computeSituations(items, { now: NOW })).toHaveLength(0);
  });
});
