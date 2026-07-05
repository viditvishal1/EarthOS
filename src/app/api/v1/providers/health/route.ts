import { listProviders, providerEnvStatus } from "@/lib/connectors/registry";
import { connectorStatuses } from "@/lib/connectors/framework";
import { buildLiveDataHealth } from "@/lib/live/health";
import { noCacheJson } from "@/lib/http/no-cache";
import { migrationCheck } from "@/lib/db/migrations";
import type { DataFreshnessState } from "@/lib/connectors/contracts";

export const dynamic = "force-dynamic";

/** Provider registry health — no secrets exposed. */
export async function GET() {
  const legacy = connectorStatuses();
  const live = await buildLiveDataHealth().catch(() => null);
  const migrations = migrationCheck();

  const providers = listProviders().map((p) => {
    const env = providerEnvStatus(p);
    const legacyStatus = p.legacyConnectorId
      ? legacy.find((s) => s.id === p.legacyConnectorId)
      : undefined;

    let state: DataFreshnessState = "unavailable";
    if (p.defaultPolicy === "off") state = "not-covered";
    else if (!env.configured && p.requiredEnv.length > 0) state = "key-required";
    else if (legacyStatus?.health === "key_gated") state = "key-required";
    else if (legacyStatus?.stale) state = "stale";
    else if (legacyStatus?.ok) state = "fresh";
    else if (legacyStatus?.health === "error") state = "unavailable";

    return {
      id: p.id,
      domains: p.domains,
      cost: p.cost,
      secretClass: p.secretClass,
      defaultPolicy: p.defaultPolicy,
      configured: env.configured,
      missingEnv: env.missingEnv,
      state,
      recordCount: legacyStatus?.itemCount ?? 0,
      lastFetch: legacyStatus?.lastFetch ?? null,
      attribution: p.attribution,
      licenseUrl: p.licenseUrl,
      coverage: p.coverage,
    };
  });

  return noCacheJson({
    providers,
    migrations,
    liveKeys: live?.keysPresent ?? [],
    checkedAt: new Date().toISOString(),
  });
}
