import type { Item } from "@/lib/types";
import { computeSituations, type Situation } from "@/lib/situation";
import { computeCiiV1 } from "@/lib/intelligence/cii/v1";
import { getCountry } from "@/lib/geo/country-index";

export type SignalType =
  | "convergence"
  | "conflict_escalation"
  | "cyber_kev"
  | "natural_hazard"
  | "maritime_activity"
  | "aviation_density";

export interface FindingEvidence {
  itemId: string;
  title: string;
  module: string;
  source: string;
  timestamp: string;
  url?: string;
}

export interface Finding {
  id: string;
  signalType: SignalType;
  title: string;
  summary: string;
  confidence: number; // 0–1
  region?: string;
  iso2?: string;
  score: number;
  evidence: FindingEvidence[];
  detectedAt: string;
  methodologyVersion: string;
}

export const FINDINGS_METHODOLOGY_VERSION = "findings-v1";

function toEvidence(items: Item[]): FindingEvidence[] {
  return items.slice(0, 8).map((i) => ({
    itemId: i.id,
    title: i.title,
    module: i.module,
    source: i.source,
    timestamp: i.timestamp,
    url: i.url,
  }));
}

function fromSituation(s: Situation): Finding {
  return {
    id: `finding:convergence:${s.key}`,
    signalType: "convergence",
    title: `Converging activity — ${s.region}`,
    summary: `${s.modules.length} modules reporting (${s.modules.join(", ")}); ${s.itemCount} items; max severity ${s.maxSeverity}`,
    confidence: Math.min(0.95, 0.4 + s.modules.length * 0.12),
    region: s.region,
    score: s.score,
    evidence: toEvidence(s.items),
    detectedAt: s.latestAt,
    methodologyVersion: FINDINGS_METHODOLOGY_VERSION,
  };
}

function detectConflictEscalation(items: Item[]): Finding[] {
  const severe = items.filter((i) => i.module === "conflict" && (i.severity ?? 0) >= 7);
  if (severe.length < 2) return [];
  const region = severe[0].region ?? "Conflict zone";
  return [{
    id: `finding:conflict:${region.replace(/\s+/g, "-").toLowerCase()}`,
    signalType: "conflict_escalation",
    title: `Conflict escalation — ${region}`,
    summary: `${severe.length} high-severity conflict events in the current window`,
    confidence: 0.75,
    region,
    score: severe.length * 3,
    evidence: toEvidence(severe),
    detectedAt: severe[0].timestamp,
    methodologyVersion: FINDINGS_METHODOLOGY_VERSION,
  }];
}

function detectCyberKev(items: Item[]): Finding[] {
  const kev = items.filter((i) => i.tags.includes("kev") || i.tags.includes("cisa-kev"));
  if (!kev.length) return [];
  return [{
    id: "finding:cyber:kev",
    signalType: "cyber_kev",
    title: "CISA KEV activity",
    summary: `${kev.length} known-exploited vulnerabilities in feed`,
    confidence: 0.85,
    score: kev.length,
    evidence: toEvidence(kev),
    detectedAt: kev[0].timestamp,
    methodologyVersion: FINDINGS_METHODOLOGY_VERSION,
  }];
}

function detectNaturalHazard(items: Item[]): Finding[] {
  const quakes = items.filter((i) => i.tags.includes("earthquake") && (i.severity ?? 0) >= 5);
  if (!quakes.length) return [];
  const top = quakes.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))[0];
  return [{
    id: `finding:quake:${top.id}`,
    signalType: "natural_hazard",
    title: `Significant earthquake — ${top.title}`,
    summary: top.summary ?? "USGS significant event",
    confidence: 0.9,
    region: top.region,
    score: top.severity ?? 5,
    evidence: toEvidence([top]),
    detectedAt: top.timestamp,
    methodologyVersion: FINDINGS_METHODOLOGY_VERSION,
  }];
}

/** Strategic risk top countries — requires CII coverage gate. */
export function computeStrategicRisk(
  items: Item[],
  limit = 5,
): { iso2: string; country: string; score: number; band: string; coverage: string }[] {
  const seen = new Set<string>();
  const out: { iso2: string; country: string; score: number; band: string; coverage: string }[] = [];
  for (const c of ["UA", "IL", "SD", "SY", "YE", "MM", "AF", "IR", "US", "IN", "CN"]) {
    if (seen.has(c)) continue;
    seen.add(c);
    const snap = computeCiiV1(c, items);
    if (snap.coverageState === "insufficient") continue;
    out.push({
      iso2: snap.iso2,
      country: snap.country,
      score: snap.score,
      band: snap.band,
      coverage: snap.coverageState,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function detectFindings(items: Item[], opts?: { limit?: number }): Finding[] {
  const limit = opts?.limit ?? 20;
  const findings: Finding[] = [
    ...computeSituations(items, { limit: 8 }).map(fromSituation),
    ...detectConflictEscalation(items),
    ...detectCyberKev(items),
    ...detectNaturalHazard(items),
  ];
  const deduped = new Map<string, Finding>();
  for (const f of findings) deduped.set(f.id, f);
  return [...deduped.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findingsForCountry(items: Item[], iso2: string): Finding[] {
  const country = getCountry(iso2);
  if (!country) return [];
  const name = country.name.toLowerCase();
  return detectFindings(items).filter(
    (f) => f.iso2 === iso2.toUpperCase()
      || (f.region?.toLowerCase().includes(name) ?? false),
  );
}
