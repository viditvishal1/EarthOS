import { listProviders, isProviderEnvEnabled } from "@/lib/connectors/registry";
import { buildLiveDataHealth } from "@/lib/live/health";
import { SEED_META_DOMAINS } from "@/lib/live/config";
import type { CoverageState, FreshnessSnapshot, FreshnessState, SourceFreshness } from "@/lib/freshness/types";

export const FRESHNESS_METHODOLOGY_VERSION = "freshness-v1";

const REQUIRED_FOR_RISK = new Set([
  "flights:global", "module:conflict", "module:news", "module:earth",
]);

const DOMAIN_LABELS: Record<string, string> = {
  "flights:global": "Global flights",
  "ships:global": "Maritime AIS",
  "webcams:all": "Public webcams",
  "cctv:all": "Traffic CCTV",
  "iss:position": "ISS position",
  "module:earth": "Earth events",
  "module:news": "News intelligence",
  "module:conflict": "Conflict & crisis",
  "module:cyber": "Cyber intelligence",
  "module:markets": "Markets",
};

function mapState(
  live: { state: string; count: number; cold?: boolean },
  configured: boolean,
): { state: FreshnessState; coverage: CoverageState } {
  if (!configured) return { state: "missing", coverage: "credentials_required" };
  if (live.state === "missing" || live.count === 0) return { state: "missing", coverage: "unavailable" };
  if (live.state === "stale") return { state: "stale", coverage: "partial" };
  return { state: "fresh", coverage: "full" };
}

function overallState(sources: SourceFreshness[]): FreshnessState {
  const required = sources.filter((s) => s.requiredForRisk);
  if (required.some((s) => s.state === "missing")) return "missing";
  if (required.some((s) => s.state === "stale")) return "stale";
  if (sources.some((s) => s.state === "error")) return "error";
  return "fresh";
}

export async function buildFreshnessSnapshot(): Promise<FreshnessSnapshot> {
  const live = await buildLiveDataHealth();
  const providers = listProviders();
  const sources: SourceFreshness[] = [];

  for (const domain of SEED_META_DOMAINS) {
    const keyHealth = live.keys[domain];
    const meta = live.seedMeta[domain];
    const legacyId = domain.replace("module:", "");
    const provider = providers.find((p) => p.legacyConnectorId === legacyId || p.id === legacyId);
    const configured = provider ? isProviderEnvEnabled(provider) : true;
    const mapped = keyHealth
      ? mapState(keyHealth, configured)
      : { state: "missing" as FreshnessState, coverage: "unavailable" as CoverageState };

    sources.push({
      id: domain,
      label: DOMAIN_LABELS[domain] ?? domain,
      domain,
      state: mapped.state,
      coverage: mapped.coverage,
      recordCount: keyHealth?.count ?? meta?.recordCount ?? 0,
      ageSeconds: keyHealth?.ageSeconds ?? null,
      updatedAt: keyHealth?.updatedAt ?? meta?.fetchedAt ?? null,
      fetchedAt: meta?.fetchedAt ?? live.lastSuccessfulSeedAt,
      source: meta?.source ?? "unknown",
      requiredForRisk: REQUIRED_FOR_RISK.has(domain),
      attribution: provider?.attribution,
    });
  }

  const intelligenceGaps = sources
    .filter((s) => s.requiredForRisk && s.state !== "fresh")
    .map((s) => `${s.label}: ${s.state === "missing" ? "no data" : s.state}`);

  return {
    sources,
    intelligenceGaps,
    overall: overallState(sources),
    checkedAt: live.checkedAt,
    methodologyVersion: FRESHNESS_METHODOLOGY_VERSION,
  };
}
