import type { Item } from "@/lib/types";
import { getCountry, itemsInCountry } from "@/lib/geo/country-index";

export const CII_METHODOLOGY_VERSION = "cii-v1";

export interface CiiComponent {
  id: string;
  label: string;
  score: number; // 0–10
  weight: number;
  evidenceCount: number;
  coverage: "full" | "partial" | "missing";
}

export interface CiiSnapshot {
  iso2: string;
  country: string;
  score: number; // 0–100
  band: "low" | "elevated" | "high" | "critical" | "insufficient_data";
  components: CiiComponent[];
  methodologyVersion: string;
  computedAt: string;
  coverageState: "full" | "partial" | "insufficient";
  intelligenceGaps: string[];
  topItems: Item[];
}

const WEIGHTS = {
  conflict: 0.35,
  unrest: 0.2,
  cyber: 0.1,
  disaster: 0.15,
  convergence: 0.2,
} as const;

function band(score: number, coverage: CiiSnapshot["coverageState"]): CiiSnapshot["band"] {
  if (coverage === "insufficient") return "insufficient_data";
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "elevated";
  return "low";
}

function componentScore(items: Item[], maxBase = 10): { score: number; count: number } {
  if (!items.length) return { score: 0, count: 0 };
  const maxSev = items.reduce((m, i) => Math.max(m, i.severity ?? 0), 0);
  const vol = Math.min(items.length, 20) / 20;
  return { score: Math.min(maxBase, maxSev * 0.7 + vol * 3), count: items.length };
}

/**
 * CII v1 — transparent weighted model from available Argus modules.
 * Not CII v8 PRD parity; versioned and evidence-backed.
 */
export function computeCiiV1(iso2: string, allItems: Item[], now = Date.now()): CiiSnapshot {
  const country = getCountry(iso2);
  const iso = iso2.toUpperCase();
  if (!country) {
    return {
      iso2: iso,
      country: iso,
      score: 0,
      band: "insufficient_data",
      components: [],
      methodologyVersion: CII_METHODOLOGY_VERSION,
      computedAt: new Date(now).toISOString(),
      coverageState: "insufficient",
      intelligenceGaps: ["Country not in reference index"],
      topItems: [],
    };
  }

  const scoped = itemsInCountry(allItems, iso);
  const conflict = scoped.filter((i) => i.module === "conflict" || i.tags.includes("conflict"));
  const cyber = scoped.filter((i) => i.module === "cyber" || i.tags.includes("cve"));
  const disaster = scoped.filter((i) => i.tags.includes("earthquake") || i.tags.includes("eonet"));
  const news = scoped.filter((i) => i.module === "news");
  const unrest = news.filter((i) => (i.severity ?? 0) >= 5);

  const cConflict = componentScore(conflict);
  const cUnrest = componentScore(unrest);
  const cCyber = componentScore(cyber);
  const cDisaster = componentScore(disaster);
  const modules = new Set(scoped.map((i) => i.module));
  const convergenceScore = Math.min(10, modules.size * 1.5);
  const convergenceCount = modules.size;

  const components: CiiComponent[] = [
    { id: "conflict", label: "Conflict & violence", score: cConflict.score, weight: WEIGHTS.conflict, evidenceCount: cConflict.count, coverage: cConflict.count ? "full" : "missing" },
    { id: "unrest", label: "Political unrest (news)", score: cUnrest.score, weight: WEIGHTS.unrest, evidenceCount: cUnrest.count, coverage: cUnrest.count ? "partial" : "missing" },
    { id: "cyber", label: "Cyber exposure", score: cCyber.score, weight: WEIGHTS.cyber, evidenceCount: cCyber.count, coverage: cCyber.count ? "partial" : "missing" },
    { id: "disaster", label: "Natural hazards", score: cDisaster.score, weight: WEIGHTS.disaster, evidenceCount: cDisaster.count, coverage: cDisaster.count ? "full" : "missing" },
    { id: "convergence", label: "Cross-domain convergence", score: convergenceScore, weight: WEIGHTS.convergence, evidenceCount: convergenceCount, coverage: convergenceCount >= 2 ? "full" : "partial" },
  ];

  const gaps: string[] = [];
  if (!cConflict.count) gaps.push("No conflict events in country window");
  if (!cDisaster.count) gaps.push("No natural hazard events");
  if (convergenceCount < 2) gaps.push("Limited cross-module corroboration");

  const raw =
    components.reduce((s, c) => s + c.score * c.weight * 10, 0);
  const hasConflictOrDisaster = cConflict.count > 0 || cDisaster.count > 0;
  const coverageState: CiiSnapshot["coverageState"] =
    !hasConflictOrDisaster && scoped.length < 3 ? "insufficient"
    : gaps.length >= 3 ? "partial"
    : "full";

  const score = coverageState === "insufficient" ? 0 : Math.round(Math.min(100, raw));
  const topItems = [...scoped]
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || b.timestamp.localeCompare(a.timestamp))
    .slice(0, 12);

  return {
    iso2: iso,
    country: country.name,
    score,
    band: band(score, coverageState),
    components,
    methodologyVersion: CII_METHODOLOGY_VERSION,
    computedAt: new Date(now).toISOString(),
    coverageState,
    intelligenceGaps: gaps,
    topItems,
  };
}
