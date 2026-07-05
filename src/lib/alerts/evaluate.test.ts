import { describe, expect, it } from "vitest";
import { itemMatchesRule, severityForRule } from "@/lib/alerts/evaluate";
import type { AlertRule } from "@/lib/alerts/rules";
import type { Item } from "@/lib/types";

const baseItem: Item = {
  id: "test-1",
  module: "cyber",
  connectorId: "cisa-kev",
  title: "Critical RCE in Windows",
  summary: "Active exploitation",
  source: "CISA",
  timestamp: new Date().toISOString(),
  severity: 9,
  tags: ["kev"],
  entities: [],
  contentPolicy: "metadata_only",
};

describe("alert evaluate", () => {
  it("matches severity threshold", () => {
    const rule: AlertRule = {
      id: "high",
      name: "High",
      ruleType: "severity_threshold",
      enabled: true,
      config: { minSeverity: 7 },
      createdAt: "",
    };
    expect(itemMatchesRule(baseItem, rule)).toBe(true);
    expect(itemMatchesRule({ ...baseItem, severity: 3 }, rule)).toBe(false);
  });

  it("matches module_tag kev", () => {
    const rule: AlertRule = {
      id: "kev",
      name: "KEV",
      ruleType: "module_tag",
      enabled: true,
      config: { module: "cyber", tag: "kev" },
      createdAt: "",
    };
    expect(itemMatchesRule(baseItem, rule)).toBe(true);
    expect(itemMatchesRule({ ...baseItem, tags: [] }, rule)).toBe(false);
  });

  it("matches cross_domain modules", () => {
    const rule: AlertRule = {
      id: "conflict",
      name: "Conflict",
      ruleType: "cross_domain",
      enabled: true,
      config: { modules: ["conflict", "earth"], minSeverity: 6 },
      createdAt: "",
    };
    expect(itemMatchesRule({ ...baseItem, module: "conflict", severity: 7 }, rule)).toBe(true);
    expect(itemMatchesRule({ ...baseItem, module: "news", severity: 7 }, rule)).toBe(false);
  });

  it("assigns critical severity for kev", () => {
    const rule: AlertRule = {
      id: "kev",
      name: "KEV",
      ruleType: "module_tag",
      enabled: true,
      config: { module: "cyber", tag: "kev" },
      createdAt: "",
    };
    expect(severityForRule(rule, baseItem)).toBe("critical");
  });
});
