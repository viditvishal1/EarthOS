// Situation scoring — cross-stream convergence, not isolated lists.
// Groups items by region and scores how many independent modules are
// reporting there, how severe the signals are, and how fresh they are.
// A documented, reproducible formula over signals — not an LLM opinion.

import type { Item } from "@/lib/types";

export interface Situation {
  key: string; // normalized region
  region: string; // display name
  score: number;
  modules: string[]; // distinct contributing modules
  maxSeverity: number;
  itemCount: number;
  latestAt: string; // ISO of freshest contributing item
  items: Item[]; // top contributing items, severity-then-recency ordered
}

const GENERIC_REGIONS = new Set([
  "", "global", "world", "worldwide", "international", "unknown", "multi", "n/a",
]);

function normalizeRegion(region: string): string {
  return region.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Hours-decay freshness weight: 1.0 now → ~0.5 at 24h → ~0 beyond 72h. */
function freshness(ts: string, now: number): number {
  const ageH = (now - new Date(ts).getTime()) / 3_600_000;
  if (Number.isNaN(ageH) || ageH < 0) return 1;
  return Math.max(0, 1 - ageH / 72) ** 1.5;
}

/**
 * Convergence score per region:
 *   (distinct modules)^2 * 2   — cross-stream corroboration dominates
 * + max severity              — the worst single signal
 * + min(items, 10) * 0.3      — volume, capped so feed spam can't win
 * all scaled by average freshness of the contributing items.
 */
export function computeSituations(items: Item[], opts?: { limit?: number; now?: number }): Situation[] {
  const { limit = 6, now = Date.now() } = opts ?? {};
  const buckets = new Map<string, { region: string; items: Item[] }>();

  for (const item of items) {
    const region = item.region?.trim();
    if (!region) continue;
    const key = normalizeRegion(region);
    if (GENERIC_REGIONS.has(key) || key.length < 3) continue;
    const bucket = buckets.get(key) ?? { region, items: [] };
    bucket.items.push(item);
    buckets.set(key, bucket);
  }

  const situations: Situation[] = [];
  for (const [key, { region, items: bucket }] of buckets) {
    const modules = [...new Set(bucket.map((i) => i.module))];
    const maxSeverity = bucket.reduce((m, i) => Math.max(m, i.severity ?? 0), 0);
    // Convergence needs corroboration: single-module regions only qualify
    // on a genuinely severe signal.
    if (modules.length < 2 && maxSeverity < 6) continue;

    const avgFresh =
      bucket.reduce((s, i) => s + freshness(i.timestamp, now), 0) / bucket.length;
    const score =
      (modules.length ** 2 * 2 + maxSeverity + Math.min(bucket.length, 10) * 0.3) * avgFresh;
    if (score <= 0) continue;

    const sorted = [...bucket].sort(
      (a, b) => (b.severity ?? 0) - (a.severity ?? 0) || b.timestamp.localeCompare(a.timestamp),
    );
    situations.push({
      key,
      region,
      score: Math.round(score * 10) / 10,
      modules: modules.sort(),
      maxSeverity,
      itemCount: bucket.length,
      latestAt: bucket.reduce((m, i) => (i.timestamp > m ? i.timestamp : m), bucket[0].timestamp),
      items: sorted.slice(0, 5),
    });
  }

  return situations.sort((a, b) => b.score - a.score).slice(0, limit);
}
