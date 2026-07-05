import { describe, expect, it } from "vitest";
import { listProviders, getProvider, isProviderEnvEnabled } from "@/lib/connectors/registry";

describe("provider registry", () => {
  it("lists core open providers", () => {
    const ids = listProviders().map((p) => p.id);
    expect(ids).toContain("usgs-earthquakes");
    expect(ids).toContain("gdelt-doc");
    expect(ids).toContain("cctv-agencies");
  });

  it("marks yahoo as off by default", () => {
    const yahoo = getProvider("yahoo-finance");
    expect(yahoo?.defaultPolicy).toBe("off");
    expect(isProviderEnvEnabled(yahoo!)).toBe(false);
  });

  it("maps legacy connector ids", () => {
    expect(getProvider("opensky")?.legacyConnectorId).toBe("opensky_states");
  });
});
