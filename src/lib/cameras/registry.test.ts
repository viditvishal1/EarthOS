import { describe, expect, it } from "vitest";
import { isAllowlistedCameraUrl, cameraLegalMode } from "@/lib/cameras/registry";

describe("camera registry", () => {
  it("allows TfL JamCam S3 snapshots", () => {
    expect(isAllowlistedCameraUrl("tfl", "https://jamcam.tfl.gov.uk/1.jpg")).toBe(true);
    expect(
      isAllowlistedCameraUrl("tfl", "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.jpg"),
    ).toBe(true);
    expect(isAllowlistedCameraUrl("tfl", "https://evil.example/1.jpg")).toBe(false);
  });

  it("defaults agency feeds to image legal mode", () => {
    expect(cameraLegalMode("wsdot")).toBe("image");
  });
});
