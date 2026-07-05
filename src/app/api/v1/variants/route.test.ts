import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/variants/route";

describe("GET /api/v1/variants", () => {
  it("lists enabled variants including world and finance", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.default).toBe("world");
    expect(body.variants.some((v: { id: string; enabled: boolean }) => v.id === "world" && v.enabled)).toBe(true);
    expect(body.variants.some((v: { id: string }) => v.id === "finance")).toBe(true);
  });
});
