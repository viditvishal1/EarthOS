import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { listRecentAlerts, countUnacknowledgedAlerts } from "@/lib/alerts/engine";
import { listAlertRules } from "@/lib/alerts/rules";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));
  const unackOnly = req.nextUrl.searchParams.get("unack") === "1";
  const [alerts, rules, unackCount] = await Promise.all([
    listRecentAlerts(limit, unackOnly),
    listAlertRules(),
    countUnacknowledgedAlerts(),
  ]);
  return noCacheJson({
    alerts,
    rules,
    count: alerts.length,
    unackCount,
    fetchedAt: new Date().toISOString(),
  });
}
