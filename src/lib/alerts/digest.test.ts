import { describe, expect, it } from "vitest";
import { buildAlertDigestMarkdown } from "@/lib/alerts/digest";
import type { AlertEvent } from "@/lib/alerts/engine";
import type { Finding } from "@/lib/intelligence/findings";

describe("buildAlertDigestMarkdown", () => {
  it("renders alerts and findings with evidence", () => {
    const alerts: AlertEvent[] = [{
      severity: "critical",
      title: "KEV: Test CVE",
      message: "Active exploitation",
      payload: {},
    }];
    const findings: Finding[] = [{
      id: "f1",
      signalType: "cyber_kev",
      title: "CISA KEV activity",
      summary: "1 KEV in feed",
      confidence: 0.85,
      score: 1,
      evidence: [{ itemId: "i1", title: "CVE-2024-1", module: "cyber", source: "CISA", timestamp: new Date().toISOString() }],
      detectedAt: new Date().toISOString(),
      methodologyVersion: "findings-v1",
    }];
    const md = buildAlertDigestMarkdown(alerts, findings);
    expect(md).toContain("# Argus intelligence digest");
    expect(md).toContain("KEV: Test CVE");
    expect(md).toContain("CISA KEV activity");
    expect(md).toContain("CVE-2024-1");
  });
});
