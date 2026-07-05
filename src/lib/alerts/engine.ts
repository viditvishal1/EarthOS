// Cross-domain alert engine — evaluates DB/memory rules against ingested items.

import { dbEnabled } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/platform/feature-flags";
import type { Item } from "@/lib/types";
import { itemMatchesRule, severityForRule, type WatchlistRef } from "@/lib/alerts/evaluate";
import { isAlertDuplicate } from "@/lib/alerts/dedup";
import { listAlertRules } from "@/lib/alerts/rules";
import { broadcastAlert } from "@/lib/alerts/stream";
import { publish } from "@/lib/events/bus";

async function serviceClient() {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

export interface AlertEvent {
  id?: number;
  rule_id?: string;
  severity: string;
  title: string;
  message?: string;
  payload: Record<string, unknown>;
  acknowledged?: boolean;
  created_at?: string;
}

async function loadWatchlistsForRules(rules: Awaited<ReturnType<typeof listAlertRules>>): Promise<Map<string, WatchlistRef>> {
  const ids = [
    ...new Set(
      rules
        .map((r) => r.config.watchlistId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const map = new Map<string, WatchlistRef>();
  if (!ids.length) return map;

  const c = await serviceClient();
  if (!c) return map;

  const { data } = await c.from("watchlists").select("id, entity_ids, symbols").in("id", ids);
  for (const row of data ?? []) {
    map.set(String(row.id), {
      id: String(row.id),
      entity_ids: (row.entity_ids as string[]) ?? [],
      symbols: (row.symbols as string[]) ?? [],
    });
  }
  return map;
}

async function persistEvent(ev: AlertEvent): Promise<AlertEvent> {
  const c = await serviceClient();
  if (!c) return ev;

  const { data, error } = await c
    .from("alert_events")
    .insert({
      rule_id: ev.rule_id ?? null,
      severity: ev.severity,
      title: ev.title,
      message: ev.message ?? null,
      payload: ev.payload,
    })
    .select()
    .single();

  if (error || !data) return ev;

  const saved = data as Record<string, unknown>;
  const full: AlertEvent = {
    id: Number(saved.id),
    rule_id: saved.rule_id ? String(saved.rule_id) : ev.rule_id,
    severity: String(saved.severity),
    title: String(saved.title),
    message: saved.message ? String(saved.message) : ev.message,
    payload: (saved.payload as Record<string, unknown>) ?? ev.payload,
    acknowledged: Boolean(saved.acknowledged),
    created_at: String(saved.created_at ?? new Date().toISOString()),
  };

  try {
    await c.from("alert_deliveries").insert({
      alert_event_id: full.id,
      channel: "in_app",
      status: "delivered",
      delivered_at: new Date().toISOString(),
    });
  } catch {
    /* delivery log optional */
  }

  return full;
}

export async function evaluateAlerts(items: Item[]): Promise<AlertEvent[]> {
  if (!items.length) return [];
  if (!(await isFeatureEnabled("alert_engine"))) return [];

  const rules = await listAlertRules();
  const enabled = rules.filter((r) => r.enabled);
  if (!enabled.length) return [];

  const watchlists = await loadWatchlistsForRules(enabled);
  const fired: AlertEvent[] = [];

  for (const item of items) {
    for (const rule of enabled) {
      if (!itemMatchesRule(item, rule, watchlists)) continue;

      const dedupKey = `${rule.id}:${item.id}`;
      if (isAlertDuplicate(dedupKey)) continue;

      const ev: AlertEvent = {
        rule_id: rule.id,
        severity: severityForRule(rule, item),
        title: `${rule.name}: ${item.title}`,
        message: item.summary,
        payload: {
          itemId: item.id,
          module: item.module,
          connectorId: item.connectorId,
          severity: item.severity,
          url: item.url,
          ruleId: rule.id,
          ruleType: rule.ruleType,
        },
      };

      const saved = await persistEvent(ev);
      fired.push(saved);
      broadcastAlert(saved);
      void publish({
        type: "alert.fired",
        module: item.module,
        itemCount: 1,
        meta: { alert: saved, ruleId: rule.id },
      }).catch(() => {});
    }
  }

  return fired.slice(0, 20);
}

export async function listRecentAlerts(limit = 20, unackOnly = false): Promise<AlertEvent[]> {
  const c = await serviceClient();
  if (!c) return [];
  let q = c.from("alert_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (unackOnly) q = q.eq("acknowledged", false);
  const { data } = await q;
  return (data ?? []) as AlertEvent[];
}

export async function countUnacknowledgedAlerts(): Promise<number> {
  const c = await serviceClient();
  if (!c) return 0;
  const { count } = await c
    .from("alert_events")
    .select("id", { count: "exact", head: true })
    .eq("acknowledged", false);
  return count ?? 0;
}

export async function acknowledgeAlerts(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const c = await serviceClient();
  if (!c) return 0;
  const { data } = await c
    .from("alert_events")
    .update({ acknowledged: true })
    .in("id", ids)
    .select("id");
  return data?.length ?? 0;
}
