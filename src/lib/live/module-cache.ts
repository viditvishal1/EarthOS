import { MODULE_CONNECTORS, runConnectors } from "@/lib/connectors";
import { MODULE_SOFT_TTL } from "@/lib/live/config";
import { readLive, readLiveCached, seedLiveSafe, type LiveResult } from "@/lib/live/store";
import { writeSeedMeta } from "@/lib/live/seed-meta";
import type { Item } from "@/lib/types";

export interface ModuleLiveResult extends LiveResult<Item[]> {
  module: string;
  fetchedAt: string;
}

/** Read-only module bundle for bootstrap — Redis only, no upstream fetch. */
export async function readModuleLiveCached(module: string): Promise<ModuleLiveResult | null> {
  const ids = MODULE_CONNECTORS[module];
  if (!ids?.length) return null;

  const ttl = MODULE_SOFT_TTL[module] ?? 300;
  const result = await readLiveCached<Item[]>(`module:${module}`, {
    ttlSeconds: ttl,
    source: `connectors:${module}`,
    fallback: [],
  });

  return {
    ...result,
    module,
    fetchedAt: new Date().toISOString(),
  };
}

/** API route read with optional stale refresh. */
export async function readModuleLive(module: string): Promise<ModuleLiveResult | null> {
  const ids = MODULE_CONNECTORS[module];
  if (!ids?.length) return null;

  const ttl = MODULE_SOFT_TTL[module] ?? 300;
  const result = await readLive<Item[]>(
    `module:${module}`,
    async () => runConnectors(ids),
    {
      ttlSeconds: ttl,
      source: `connectors:${module}`,
      fallback: [],
      coldTimeoutMs: module === "markets" ? 12_000 : 6_000,
      refreshWhenStale: true,
      seedEmpty: false,
      allowColdFetch: true,
    },
  );

  return {
    ...result,
    module,
    fetchedAt: new Date().toISOString(),
  };
}

export async function seedModuleLive(module: string): Promise<number> {
  const ids = MODULE_CONNECTORS[module];
  if (!ids?.length) return -1;
  try {
    const items = await runConnectors(ids);
    if (items.length === 0) {
      const cached = await readLiveCached<Item[]>(`module:${module}`, {
        ttlSeconds: MODULE_SOFT_TTL[module] ?? 300,
        source: `connectors:${module}`,
        fallback: [],
      });
      return cached.data.length > 0 ? cached.data.length : 0;
    }
    const write = await seedLiveSafe(`module:${module}`, items, `connectors:${module}`);
    if (!write.ok) {
      const cached = await readLiveCached<Item[]>(`module:${module}`, {
        ttlSeconds: MODULE_SOFT_TTL[module] ?? 300,
        source: `connectors:${module}`,
        fallback: [],
      });
      return cached.data.length;
    }
    await writeSeedMeta(`module:${module}`, items.length, `connectors:${module}`);
    return items.length;
  } catch {
    const cached = await readLiveCached<Item[]>(`module:${module}`, {
      ttlSeconds: MODULE_SOFT_TTL[module] ?? 300,
      source: `connectors:${module}`,
      fallback: [],
    });
    return cached.data.length > 0 ? cached.data.length : -1;
  }
}
