import { describe, expect, it } from "vitest";
import { parseUsgsCollection, isUsgsFeature } from "@/lib/connectors/validators/usgs";

describe("USGS validator", () => {
  it("parses valid GeoJSON features", () => {
    const data = {
      features: [
        {
          id: "test1",
          properties: { mag: 4.2, place: "Test", time: 1_700_000_000_000 },
          geometry: { type: "Point", coordinates: [-122, 37] },
        },
        { id: "bad" },
      ],
    };
    const features = parseUsgsCollection(data);
    expect(features).toHaveLength(1);
    expect(isUsgsFeature(features[0])).toBe(true);
  });
});
