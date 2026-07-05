import { describe, expect, it } from "vitest";
import { clusterObservations } from "@/lib/observations/cluster";
import type { Observation } from "@/lib/observations/types";

function obs(id: string, title: string, url?: string): Observation {
  return {
    id,
    category: "news",
    title,
    url,
    tags: [],
    entities: [],
    provenance: {
      providerId: "test",
      sourceRecordId: id,
      observedAt: "2026-07-05T12:00:00Z",
      fetchedAt: "2026-07-05T12:00:00Z",
      licensePolicy: "metadata_only",
      attribution: "Test",
    },
  };
}

describe("clusterObservations", () => {
  it("groups duplicate URLs", () => {
    const clusters = clusterObservations([
      obs("1", "Fire in Oregon", "https://example.com/a"),
      obs("2", "Fire in Oregon duplicate", "https://example.com/a"),
      obs("3", "Other story", "https://example.com/b"),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].memberCount).toBeGreaterThanOrEqual(1);
  });
});
