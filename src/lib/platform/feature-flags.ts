// Feature flags — DB-backed with env override fallback.

import { dbEnabled } from "@/lib/db";
import { getFeatureFlagsFromDb } from "@/lib/db/platform";

import { redisConfigured } from "@/lib/cache/redis-config";

const ENV_PREFIX = "EARTHOS_FLAG_";

const DEFAULTS: Record<string, boolean> = {
  r2_archive: false,
  redis_cache: false,
  clickhouse_analytics: false,
  opensearch: false,
  hybrid_search: true,
  investigations: true,
  alert_engine: true,
  gdelt_connector: true,
  background_ingestion: Boolean(process.env.SUPABASE_SERVICE_KEY),
  strict_rate_limits: true,
};

const cache: { at: number; flags: Record<string, boolean> } = { at: 0, flags: {} };

function envOverride(key: string): boolean | undefined {
  const envKey = `${ENV_PREFIX}${key.toUpperCase().replace(/-/g, "_")}`;
  const v = process.env[envKey];
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

export async function loadFeatureFlags(): Promise<Record<string, boolean>> {
  if (Date.now() - cache.at < 60_000 && Object.keys(cache.flags).length > 0) {
    return cache.flags;
  }

  const merged = { ...DEFAULTS };

  if (dbEnabled()) {
    try {
      const dbFlags = await getFeatureFlagsFromDb();
      for (const [k, v] of Object.entries(dbFlags)) merged[k] = v;
    } catch {
      /* use defaults */
    }
  }

  for (const key of Object.keys(merged)) {
    const override = envOverride(key);
    if (override !== undefined) merged[key] = override;
  }

  // Auto-enable when credentials present
  if (process.env.CLOUDFLARE_R2_BUCKET && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
    merged.r2_archive = merged.r2_archive || Boolean(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  }
  if (redisConfigured()) {
    merged.redis_cache = true;
  }

  cache.at = Date.now();
  cache.flags = merged;
  return merged;
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await loadFeatureFlags();
  return flags[key] ?? DEFAULTS[key] ?? false;
}

export function invalidateFeatureFlagCache(): void {
  cache.at = 0;
  cache.flags = {};
}
