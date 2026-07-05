import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { deleteAlertRule, listAlertRules, upsertAlertRule, type AlertRuleType } from "@/lib/alerts/rules";
import { isPrincipalError, requirePrivateApi } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  const rules = await listAlertRules();
  return noCacheJson({ rules, count: rules.length, fetchedAt: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.name || !body?.ruleType) {
    return noCacheJson({ error: "id, name, ruleType required" }, { status: 400 });
  }
  const rule = await upsertAlertRule({
    id: String(body.id),
    name: String(body.name),
    ruleType: body.ruleType as AlertRuleType,
    enabled: body.enabled !== false,
    config: body.config ?? {},
  });
  return noCacheJson({ rule, fetchedAt: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return noCacheJson({ error: "id required" }, { status: 400 });
  await deleteAlertRule(id);
  return noCacheJson({ ok: true });
}
