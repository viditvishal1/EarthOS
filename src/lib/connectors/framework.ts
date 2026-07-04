// Connector framework — every source implements the same lifecycle:
//   Source → Collector → Normalizer → Content-Policy check → [Graph | Cache] → API → Client
// Adding the 40th connector costs the same effort as the 4th: write a
// manifest + a normalize function, register it, done.

import type { ConnectorManifest, ConnectorStatus, Item } from "@/lib/types";
import { ingestItems } from "@/lib/graph";
import { publish } from "@/lib/events/bus";

interface CacheEntry {
  at: number;
  items: Item[];
}

type GlobalStore = {
  cache: Map<string, CacheEntry>;
  status: Map<string, ConnectorStatus>;
};

// Survives across route-handler invocations within one server process.
const g = globalThis as unknown as { __earthos?: GlobalStore };
const store: GlobalStore = (g.__earthos ??= {
  cache: new Map(),
  status: new Map(),
});

export const connectors = new Map<
  string,
  { manifest: ConnectorManifest; collect: () => Promise<Item[]> }
>();

export function registerConnector(
  manifest: ConnectorManifest,
  collect: () => Promise<Item[]>,
) {
  connectors.set(manifest.id, { manifest, collect });
}

/** Fetch JSON/text with a hard timeout so one slow free-tier API never hangs a page. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "User-Agent": "EarthOS/2.0 (open-source intelligence dashboard)",
        ...rest.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a connector through the lifecycle with per-connector isolation:
 * a failing source returns its last good cache (or []) and records the
 * error in connector status — it never throws into the page.
 */
export async function runConnector(id: string): Promise<Item[]> {
  const c = connectors.get(id);
  if (!c) return [];
  const { manifest, collect } = c;

  if (manifest.requiresKey && !process.env[manifest.requiresKey]) {
    store.status.set(id, {
      id,
      module: manifest.module,
      source: manifest.source,
      ok: false,
      keyGated: true,
      itemCount: 0,
      lastError: `Set ${manifest.requiresKey} in .env.local to enable this source`,
    });
    return [];
  }

  const cached = store.cache.get(id);
  const fresh = cached && Date.now() - cached.at < manifest.scheduleSeconds * 1000;
  if (cached && fresh) return cached.items;

  const started = Date.now();
  try {
    let items = await collect();
    // Content-policy check: strip full text unless the source permits caching it.
    if (manifest.contentPolicy !== "full_cache") {
      items = items.map((it) => ({ ...it, body: undefined }));
    }
    if (manifest.contentPolicy === "metadata_only") {
      items = items.map((it) => ({ ...it, summary: undefined }));
    }
    store.cache.set(id, { at: Date.now(), items });
    store.status.set(id, {
      id,
      module: manifest.module,
      source: manifest.source,
      ok: true,
      keyGated: false,
      lastFetch: new Date().toISOString(),
      itemCount: items.length,
      latencyMs: Date.now() - started,
    });
    ingestItems(items);
    await publish({ type: "connector.run", connectorId: id, module: manifest.module, itemCount: items.length });
    return items;
  } catch (err) {
    await publish({
      type: "connector.error",
      connectorId: id,
      module: manifest.module,
      error: err instanceof Error ? err.message : String(err),
    });
    store.status.set(id, {
      id,
      module: manifest.module,
      source: manifest.source,
      ok: false,
      keyGated: false,
      lastFetch: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : String(err),
      itemCount: cached?.items.length ?? 0,
      latencyMs: Date.now() - started,
    });
    return cached?.items ?? []; // degrade to last good data, never crash the module
  }
}

export async function runConnectors(ids: string[]): Promise<Item[]> {
  const results = await Promise.all(ids.map(runConnector));
  return results
    .flat()
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}

/**
 * Like runConnectors but with a hard time budget per connector: whatever is
 * cached or fast makes this response; cold slow sources keep fetching in the
 * background and are picked up from cache on the next request.
 */
export async function runConnectorsWithBudget(
  ids: string[],
  budgetMs = 4000,
): Promise<Item[]> {
  const results = await Promise.all(
    ids.map((id) =>
      Promise.race([
        runConnector(id).catch(() => [] as Item[]),
        new Promise<Item[]>((resolve) => setTimeout(() => resolve([]), budgetMs)),
      ]),
    ),
  );
  return results
    .flat()
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}

export function connectorStatuses(): ConnectorStatus[] {
  // Include registered-but-never-run connectors so the settings page is complete.
  const out: ConnectorStatus[] = [];
  for (const [id, { manifest }] of connectors) {
    out.push(
      store.status.get(id) ?? {
        id,
        module: manifest.module,
        source: manifest.source,
        ok: true,
        keyGated: Boolean(manifest.requiresKey && !process.env[manifest.requiresKey]),
        itemCount: 0,
      },
    );
  }
  return out.sort((a, b) => a.module.localeCompare(b.module));
}
