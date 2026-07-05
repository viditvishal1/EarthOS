import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/findings/route";
import { NextRequest } from "next/server";
import type { Item } from "@/lib/types";

vi.mock("@/lib/live/module-cache", () => ({
  readModuleLiveCached: vi.fn(async (module: string) => ({
    data: module === "cyber"
      ? [{
          id: "kev-1",
          module: "cyber",
          connectorId: "cisa",
          title: "KEV entry",
          source: "CISA",
          timestamp: new Date().toISOString(),
          severity: 9,
          tags: ["kev"],
          entities: [],
          contentPolicy: "metadata_only",
        } satisfies Item]
      : [],
  })),
}));

describe("GET /api/v1/findings", () => {
  it("returns findings array and strategic risk", async () => {
    const res = await GET(new NextRequest("http://localhost/api/v1/findings?limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.findings)).toBe(true);
    expect(body.findings.some((f: { signalType: string }) => f.signalType === "cyber_kev")).toBe(true);
    expect(body.methodologyVersion).toBe("findings-v1");
    expect(Array.isArray(body.strategicRisk)).toBe(true);
  });
});
