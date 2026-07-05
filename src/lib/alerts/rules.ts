import { dbEnabled } from "@/lib/db";

export type AlertRuleType = "severity_threshold" | "module_tag" | "keyword";

export interface AlertRule {
  id: string;
  name: string;
  ruleType: AlertRuleType;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

const DEFAULT_RULES: AlertRule[] = [
  {
    id: "high-severity",
    name: "High severity events",
    ruleType: "severity_threshold",
    enabled: true,
    config: { minSeverity: 7 },
    createdAt: new Date().toISOString(),
  },
  {
    id: "kev-cyber",
    name: "CISA KEV entries",
    ruleType: "module_tag",
    enabled: true,
    config: { module: "cyber", tag: "kev" },
    createdAt: new Date().toISOString(),
  },
];

const memoryRules = new Map<string, AlertRule>(DEFAULT_RULES.map((r) => [r.id, r]));

async function serviceClient() {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

function rowToRule(row: Record<string, unknown>): AlertRule {
  return {
    id: String(row.id),
    name: String(row.name),
    ruleType: row.rule_type as AlertRuleType,
    enabled: Boolean(row.enabled),
    config: (row.config_json as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listAlertRules(): Promise<AlertRule[]> {
  const c = await serviceClient();
  if (!c) return [...memoryRules.values()];
  const { data } = await c.from("alert_rules").select("*").order("created_at", { ascending: false }).limit(50);
  if (!data?.length) return [...memoryRules.values()];
  return data.map((r) => rowToRule(r as Record<string, unknown>));
}

export async function upsertAlertRule(rule: Omit<AlertRule, "createdAt"> & { createdAt?: string }): Promise<AlertRule> {
  const full: AlertRule = {
    ...rule,
    createdAt: rule.createdAt ?? new Date().toISOString(),
  };
  const c = await serviceClient();
  if (!c) {
    memoryRules.set(full.id, full);
    return full;
  }
  const { data, error } = await c.from("alert_rules").upsert({
    id: full.id,
    name: full.name,
    rule_type: full.ruleType,
    enabled: full.enabled,
    config_json: full.config,
  }).select().single();
  if (error) throw error;
  return rowToRule(data as Record<string, unknown>);
}

export async function deleteAlertRule(id: string): Promise<void> {
  memoryRules.delete(id);
  const c = await serviceClient();
  if (c) await c.from("alert_rules").delete().eq("id", id);
}
