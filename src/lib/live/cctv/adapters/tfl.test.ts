import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("fetchTflCameras", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.TFL_APP_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes JamCam places into CctvCamera objects", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "JamCam_00001.01234",
          commonName: "A102 Blackwall Tunnel Northbound",
          lat: 51.507,
          lon: -0.02,
          additionalProperties: [
            { key: "imageUrl", value: "https://example.com/jam.jpg" },
            { key: "available", value: "true" },
          ],
        },
        {
          id: "JamCam_offline",
          lat: 51.5,
          lon: -0.1,
          additionalProperties: [
            { key: "imageUrl", value: "https://example.com/off.jpg" },
            { key: "available", value: "false" },
          ],
        },
        { id: "bad", lat: 51.5 },
      ],
    } as Response);

    const { fetchTflCameras } = await import("@/lib/live/cctv/adapters/tfl");
    const cameras = await fetchTflCameras();

    expect(cameras).toHaveLength(1);
    expect(cameras[0]).toMatchObject({
      id: "tfl:JamCam_00001.01234",
      source: "tfl",
      title: "A102 Blackwall Tunnel Northbound",
      lat: 51.507,
      lng: -0.02,
      imageUrl: "https://example.com/jam.jpg",
      refreshSeconds: 120,
      region: "London",
      status: "active",
    });
    expect(cameras[0].lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("appends TFL_APP_KEY when configured", async () => {
    process.env.TFL_APP_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { fetchTflCameras } = await import("@/lib/live/cctv/adapters/tfl");
    await fetchTflCameras();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("app_key=test-key"),
      expect.any(Object),
    );
  });
});
