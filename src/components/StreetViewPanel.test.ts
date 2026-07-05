import { describe, expect, it } from "vitest";
import {
  googleStreetViewEmbedUrl,
  mapillaryAppUrl,
  mapillaryEmbedUrl,
} from "./StreetViewPanel";

describe("StreetViewPanel URLs", () => {
  it("builds Google Street View embed URL", () => {
    const url = googleStreetViewEmbedUrl("test-key", 28.61, 77.21);
    expect(url).toContain("google.com/maps/embed/v1/streetview");
    expect(url).toContain("key=test-key");
    expect(url).toContain("location=28.61,77.21");
  });

  it("builds Mapillary embed URL", () => {
    const url = mapillaryEmbedUrl(51.51, -0.13);
    expect(url).toBe(
      "https://www.mapillary.com/embed?lat=51.51&lng=-0.13&z=17&focus=photo&style=photo",
    );
  });

  it("builds Mapillary app deep link", () => {
    expect(mapillaryAppUrl(40.71, -74.01)).toBe(
      "https://www.mapillary.com/app/?lat=40.71&lng=-74.01&z=17",
    );
  });
});
