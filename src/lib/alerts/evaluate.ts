import type { Item } from "@/lib/types";
import type { AlertRule } from "@/lib/alerts/rules";

export interface WatchlistRef {
  id: string;
  entity_ids: string[];
  symbols: string[];
}

function textBlob(item: Item): string {
  return `${item.title} ${item.summary ?? ""} ${item.body ?? ""}`.toLowerCase();
}

function matchesWatchlist(item: Item, wl: WatchlistRef): boolean {
  const blob = textBlob(item);
  for (const eid of wl.entity_ids ?? []) {
    if (eid && blob.includes(String(eid).toLowerCase())) return true;
    if (item.entities.some((e) => e.name.toLowerCase().includes(String(eid).toLowerCase()))) return true;
  }
  for (const sym of wl.symbols ?? []) {
    const s = String(sym).toLowerCase();
    if (s && (blob.includes(s) || item.tags.some((t) => t.toLowerCase() === s))) return true;
  }
  return false;
}

/** Cross-domain rule evaluation — AND of all specified config constraints. */
export function itemMatchesRule(
  item: Item,
  rule: AlertRule,
  watchlists: Map<string, WatchlistRef> = new Map(),
): boolean {
  if (!rule.enabled) return false;
  const cfg = rule.config;

  if (rule.ruleType === "severity_threshold") {
    const min = Number(cfg.minSeverity ?? 7);
    if ((item.severity ?? 0) < min) return false;
  }

  if (rule.ruleType === "module_tag" || rule.ruleType === "cross_domain") {
    if (cfg.module && item.module !== cfg.module) return false;
    const modules = cfg.modules as string[] | undefined;
    if (modules?.length && !modules.includes(item.module)) return false;
    if (cfg.tag && !item.tags.includes(String(cfg.tag))) return false;
    if (cfg.minSeverity != null && (item.severity ?? 0) < Number(cfg.minSeverity)) return false;
  }

  if (rule.ruleType === "keyword") {
    const kw = String(cfg.keyword ?? "").toLowerCase().trim();
    if (!kw || !textBlob(item).includes(kw)) return false;
  } else if (cfg.keyword) {
    const kw = String(cfg.keyword).toLowerCase().trim();
    if (kw && !textBlob(item).includes(kw)) return false;
  }

  if (rule.ruleType === "watchlist_match" || cfg.watchlistId) {
    const wlId = String(cfg.watchlistId ?? "");
    const wl = watchlists.get(wlId);
    if (!wl || !matchesWatchlist(item, wl)) return false;
  }

  if (rule.ruleType === "cross_domain") {
    const regions = cfg.regions as string[] | undefined;
    if (regions?.length && item.region && !regions.includes(item.region)) return false;
  }

  return true;
}

export function severityForRule(rule: AlertRule, item: Item): string {
  if (rule.ruleType === "module_tag" && rule.config.tag === "kev") return "critical";
  if ((item.severity ?? 0) >= 8) return "critical";
  if ((item.severity ?? 0) >= 6) return "warning";
  return "info";
}
