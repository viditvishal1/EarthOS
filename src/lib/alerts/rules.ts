import type { SupabaseClient } from "@supabase/supabase-js";
import { dbEnabled } from "@/lib/db";
import type { ApiPrincipal } from "@/lib/auth/api-guard";
import { resolveDbClient } from "@/lib/auth/api-session";

export type AlertRuleType =
  | "severity_threshold"
  | "module_tag"
  | "keyword"
  | "watchlist_match"
  | "cross_domain";

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
  {
    id: "conflict-escalation",
    name: "Conflict module escalation",
    ruleType: "cross_domain",
    enabled: true,
    config: { modules: ["conflict", "earth"], minSeverity: 6 },
    createdAt: new Date().toISOString(),
  },
  {
    id: "maritime-distress",
    name: "Maritime high-severity",
    ruleType: "cross_domain",
    enabled: true,
    config: { module: "maritime", minSeverity: 5 },
    createdAt: new Date().toISOString(),
  },
];

const memoryRules = new Map<string, AlertRule>(DEFAULT_RULES.map((r) => [r.id, r]));

async function serviceClient(): Promise<SupabaseClient | null> {
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

async function dbFor(principal?: ApiPrincipal): Promise<SupabaseClient | null> {
  if (principal) return resolveDbClient(principal);
  return serviceClient();
}

export async function listAlertRules(principal?: ApiPrincipal): Promise<AlertRule[]> {
  const c = await dbFor(principal);
  if (!c) return [...memoryRules.values()];
  const { data, error } = await c.from("alert_rules").select("*").order("created_at", { ascending: false }).limit(50);
  if (error || !data?.length) {
    if (principal?.role === "user") return [];
    return [...memoryRules.values()];
  }
  return data.map((r) => rowToRule(r as Record<string, unknown>));
}

export async function upsertAlertRule(
  rule: Omit<AlertRule, "createdAt"> & { createdAt?: string },
  principal?: ApiPrincipal,
): Promise<AlertRule> {
  const full: AlertRule = {
    ...rule,
    createdAt: rule.createdAt ?? new Date().toISOString(),
  };
  const c = await dbFor(principal);
  if (!c) {
    memoryRules.set(full.id, full);
    return full;
  }
  const row: Record<string, unknown> = {
    id: full.id,
    name: full.name,
    rule_type: full.ruleType,
    enabled: full.enabled,
    config_json: full.config,
  };
  if (principal?.role === "user") row.owner_id = principal.id;

  const { data, error } = await c.from("alert_rules").upsert(row).select().single();
  if (error) throw error;
  return rowToRule(data as Record<string, unknown>);
}

export async function deleteAlertRule(id: string, principal?: ApiPrincipal): Promise<void> {
  memoryRules.delete(id);
  const c = await dbFor(principal);
  if (c) await c.from("alert_rules").delete().eq("id", id);
}
