import { describe, expect, it } from "vitest";
import { cctvToItem } from "@/lib/hooks/useGlobeLiveData";
import type { CctvCamera } from "@/lib/live/cctv/types";

describe("cctvToItem", () => {
  it("labels snapshots with refresh interval, not LIVE", () => {
    const cam: CctvCamera = {
      id: "tfl:test",
      source: "tfl",
      title: "Test Camera",
      lat: 51.5,
      lng: -0.1,
      imageUrl: "https://example.com/snap.jpg",
      refreshSeconds: 120,
      region: "London",
      lastSeenAt: "2026-07-05T12:00:00.000Z",
      status: "active",
    };
    const item = cctvToItem(cam);
    expect(item.summary).toContain("Snapshot");
    expect(item.summary).toContain("~2 min");
    expect(item.summary).not.toMatch(/\bLIVE\b/i);
    expect(item.extra?.snapshot).toBe(true);
    expect(item.tags).toContain("cctv");
  });
});
