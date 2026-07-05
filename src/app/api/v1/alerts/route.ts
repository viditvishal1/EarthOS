import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { listRecentAlerts } from "@/lib/alerts/engine";
import { listAlertRules } from "@/lib/alerts/rules";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20)));
  const [alerts, rules] = await Promise.all([listRecentAlerts(limit), listAlertRules()]);
  return noCacheJson({
    alerts,
    rules,
    count: alerts.length,
    fetchedAt: new Date().toISOString(),
  });
}
