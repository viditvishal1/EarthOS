import { describe, expect, it } from "vitest";
import { isAllowlistedCameraUrl, cameraLegalMode } from "@/lib/cameras/registry";

describe("camera registry", () => {
  it("allows TfL JamCam hosts", () => {
    expect(isAllowlistedCameraUrl("tfl", "https://jamcam.tfl.gov.uk/1.jpg")).toBe(true);
    expect(isAllowlistedCameraUrl("tfl", "https://evil.example/1.jpg")).toBe(false);
  });

  it("defaults agency feeds to image legal mode", () => {
    expect(cameraLegalMode("wsdot")).toBe("image");
  });
});
