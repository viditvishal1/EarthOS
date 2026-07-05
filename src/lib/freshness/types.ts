export type CoverageState = "full" | "partial" | "unavailable" | "credentials_required";
export type FreshnessState = "fresh" | "stale" | "missing" | "error";

export interface SourceFreshness {
  id: string;
  label: string;
  domain: string;
  state: FreshnessState;
  coverage: CoverageState;
  recordCount: number;
  ageSeconds: number | null;
  updatedAt: string | null;
  fetchedAt: string | null;
  source: string;
  requiredForRisk: boolean;
  attribution?: string;
  errorCode?: string;
}

export interface FreshnessSnapshot {
  sources: SourceFreshness[];
  intelligenceGaps: string[];
  overall: FreshnessState;
  checkedAt: string;
  methodologyVersion: string;
}
