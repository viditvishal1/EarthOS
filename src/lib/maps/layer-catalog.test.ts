import { describe, expect, it } from "vitest";
import { defaultLayerToggles, buildMapLayers, LAYER_CATALOG, type LayerData } from "./layer-catalog";
import type { Item } from "@/lib/types";

const item = (id: string): Item => ({
  id,
  module: "earth",
  connectorId: "test",
  title: id,
  source: "test",
  timestamp: "2026-01-01T00:00:00Z",
  lat: 1,
  lon: 2,
  tags: [],
  entities: [],
  contentPolicy: "metadata_only",
});

describe("layer catalog", () => {
  it("has 32 layer types", () => {
    expect(Object.keys(LAYER_CATALOG).length).toBe(32);
  });

  it("builds visible layers from toggles", () => {
    const toggles = defaultLayerToggles();
    toggles.quakes = true;
    const data = Object.fromEntries(
      Object.keys(LAYER_CATALOG).map((k) => [k, []]),
    ) as unknown as LayerData;
    data.quakes = [item("q1")];
    const layers = buildMapLayers(data, toggles, null);
    expect(layers.some((l) => l.id === "quakes")).toBe(true);
  });
});
