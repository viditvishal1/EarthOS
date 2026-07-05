import { describe, expect, it } from "vitest";
import { isAishubConfigured, isGeminiConfigured, isMapplsConfigured, isTomtomConfigured } from "@/lib/platform/integrations";

describe("integrations config", () => {
  it("detects AISHub key presence", () => {
    delete process.env.AISHUB_API_KEY;
    expect(isAishubConfigured()).toBe(false);
    process.env.AISHUB_API_KEY = "test";
    expect(isAishubConfigured()).toBe(true);
    delete process.env.AISHUB_API_KEY;
  });

  it("detects TomTom key presence", () => {
    delete process.env.TOMTOM_API_KEY;
    expect(isTomtomConfigured()).toBe(false);
    process.env.TOMTOM_API_KEY = "test";
    expect(isTomtomConfigured()).toBe(true);
    delete process.env.TOMTOM_API_KEY;
  });

  it("detects Mappls key presence", () => {
    delete process.env.MAPPLS_API_KEY;
    delete process.env.MAPMYINDIA_API_KEY;
    expect(isMapplsConfigured()).toBe(false);
    process.env.MAPPLS_API_KEY = "test";
    expect(isMapplsConfigured()).toBe(true);
    delete process.env.MAPPLS_API_KEY;
    process.env.MAPMYINDIA_API_KEY = "test";
    expect(isMapplsConfigured()).toBe(true);
    delete process.env.MAPMYINDIA_API_KEY;
  });

  it("detects Gemini key presence", () => {
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = "test";
    expect(isGeminiConfigured()).toBe(true);
    delete process.env.GEMINI_API_KEY;
  });
});
