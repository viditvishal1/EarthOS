import { describe, expect, it } from "vitest";

describe("batch 3 connectors", () => {
  it("registers static geo, outbreaks, and airport hubs", async () => {
    await import("./static-geo");
    await import("./outbreaks");
    await import("./major-airports");
    const { connectorStatuses } = await import("./framework");
    const ids = connectorStatuses().map((c) => c.id);
    expect(ids).toContain("static_geo_reference");
    expect(ids).toContain("who_disease_outbreaks");
    expect(ids).toContain("major_airport_hubs");
  });
});
