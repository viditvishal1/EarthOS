/**
 * Provider orchestration — schedules due providers and records run metadata.
 * Production queue durability is delegated to Postgres when DATABASE_URL is set.
 */

import { listProviders, isProviderEnvEnabled } from "@/lib/connectors/registry";
import type { ProviderDefinition } from "@/lib/connectors/contracts";
import { runConnector, connectorStatuses } from "@/lib/connectors/framework";
import { logInfo, logWarn } from "@/lib/observability/logger";

export interface OrchestratorRunResult {
  providerId: string;
  legacyConnectorId?: string;
  status: "ok" | "skipped" | "error";
  count: number;
  durationMs: number;
  error?: string;
}

export function providersDue(now = Date.now()): ProviderDefinition[] {
  return listProviders().filter((p) => {
    if (!isProviderEnvEnabled(p) && p.defaultPolicy !== "default") return false;
    if (!p.legacyConnectorId) return false;
    const st = connectorStatuses().find((s) => s.id === p.legacyConnectorId);
    if (!st?.lastFetch) return true;
    const age = (now - new Date(st.lastFetch).getTime()) / 1000;
    return age >= p.scheduleSeconds;
  });
}

export async function runDueProviders(limit = 8): Promise<OrchestratorRunResult[]> {
  const due = providersDue().slice(0, limit);
  const results: OrchestratorRunResult[] = [];

  for (const provider of due) {
    const started = Date.now();
    const legacyId = provider.legacyConnectorId!;
    try {
      const items = await runConnector(legacyId);
      results.push({
        providerId: provider.id,
        legacyConnectorId: legacyId,
        status: "ok",
        count: items.length,
        durationMs: Date.now() - started,
      });
      logInfo("orchestrator.provider_ok", { providerId: provider.id, count: items.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        providerId: provider.id,
        legacyConnectorId: legacyId,
        status: "error",
        count: 0,
        durationMs: Date.now() - started,
        error: message.slice(0, 200),
      });
      logWarn("orchestrator.provider_error", { providerId: provider.id, error: message.slice(0, 200) });
    }
  }

  return results;
}
