import { describe, expect, it } from "vitest";
import { openskyCredentialsConfigured } from "@/lib/connectors/opensky-auth";

describe("opensky auth", () => {
  it("reports unconfigured when env missing", () => {
    delete process.env.OPENSKY_CLIENT_ID;
    delete process.env.OPENSKY_CLIENT_SECRET;
    expect(openskyCredentialsConfigured()).toBe(false);
  });

  it("reports configured when both env vars set", () => {
    process.env.OPENSKY_CLIENT_ID = "id";
    process.env.OPENSKY_CLIENT_SECRET = "secret";
    expect(openskyCredentialsConfigured()).toBe(true);
    delete process.env.OPENSKY_CLIENT_ID;
    delete process.env.OPENSKY_CLIENT_SECRET;
  });
});
