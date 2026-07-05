import { test, expect } from "@playwright/test";

test.describe("public API smoke", () => {
  test("GET /api/v1/variants", async ({ request }) => {
    const res = await request.get("/api/v1/variants");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.default).toBe("world");
    expect(body.variants.length).toBeGreaterThanOrEqual(6);
  });

  test("GET /api/v1/findings", async ({ request }) => {
    const res = await request.get("/api/v1/findings?limit=5");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.findings)).toBe(true);
    expect(body.methodologyVersion).toBe("findings-v1");
  });

  test("GET /api/v1/freshness", async ({ request }) => {
    const res = await request.get("/api/v1/freshness");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.methodologyVersion).toBe("freshness-v1");
    expect(Array.isArray(body.sources)).toBe(true);
  });

  test("GET /api/v1/alerts returns rules", async ({ request }) => {
    const res = await request.get("/api/v1/alerts?limit=5");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(Array.isArray(body.rules)).toBe(true);
  });

  test("GET /api/status", async ({ request }) => {
    const res = await request.get("/api/status");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.connectors)).toBe(true);
  });
});

test.describe("protected API gate", () => {
  test("POST /api/v1/alerts/rules rejects without auth when secret configured", async ({ request }) => {
    test.skip(!process.env.ARGUS_API_SECRET, "ARGUS_API_SECRET not set in CI");
    const res = await request.post("/api/v1/alerts/rules", {
      data: { id: "t", name: "t", ruleType: "keyword", config: { keyword: "x" } },
    });
    expect(res.status()).toBe(401);
  });
});
