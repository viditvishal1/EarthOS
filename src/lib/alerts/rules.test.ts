import { describe, expect, it } from "vitest";
import { listAlertRules } from "@/lib/alerts/rules";

describe("alert rules", () => {
  it("returns default rules in memory mode", async () => {
    const rules = await listAlertRules();
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => r.id === "kev-cyber")).toBe(true);
  });
});
