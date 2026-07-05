// Connector framework — every source implements the same lifecycle:
//   Source → Collector → Normalizer → Content-Policy check → [Graph | Cache] → API → Client

import type { ConnectorManifest, ConnectorStatus, Item } from "@/lib/types";
import { ingestItems } from "@/lib/graph";
import { publish } from "@/lib/events/bus";
import { isSourceEnabled } from "@/lib/config/sources";
import { recordConnectorRun } from "@/lib/db/platform";
import { enqueueIngestion } from "@/lib/queue/ingestion";
import { trackConnectorRequest } from "@/lib/usage/tracker";
import { evaluateAlerts } from "@/lib/alerts/engine";

interface CacheEntry {
  at: number;
  items: Item[];
}

type GlobalStore = {
  cache: Map<string, CacheEntry>;
  status: Map<string, ConnectorStatus>;
  failures: Map<string, number>;
};

const g = globalThis as unknown as { __earthos?: GlobalStore };
const store: GlobalStore = (g.__earthos ??= {
  cache: new Map(),
  status: new Map(),
  failures: new Map(),
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
        "User-Agent": "Argus/2.0 (open-source intelligence dashboard)",
        ...rest.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function setStatus(id: string, manifest: ConnectorManifest, partial: Partial<ConnectorStatus>): void {
  const prev = store.status.get(id);
  store.status.set(id, {
    id,
    module: manifest.module,
    source: manifest.source,
    ok: partial.ok ?? prev?.ok ?? false,
    health: partial.health ?? prev?.health ?? "unknown",
    keyGated: partial.keyGated ?? prev?.keyGated ?? false,
    itemCount: partial.itemCount ?? prev?.itemCount ?? 0,
    lastFetch: partial.lastFetch ?? prev?.lastFetch,
    lastError: partial.lastError ?? prev?.lastError,
    latencyMs: partial.latencyMs ?? prev?.latencyMs,
    provider: manifest.source,
    geographicScope: partial.geographicScope,
    dataDelay: partial.dataDelay,
    stale: partial.stale,
  });
}

export async function runConnector(id: string): Promise<Item[]> {
  const c = connectors.get(id);
  if (!c) return [];
  const { manifest, collect } = c;

  if (!(await isSourceEnabled(id))) {
    setStatus(id, manifest, { ok: false, health: "disabled", keyGated: false, itemCount: 0 });
    return [];
  }

  if (manifest.requiresKey && !process.env[manifest.requiresKey]) {
    setStatus(id, manifest, {
      ok: false,
      health: "key_gated",
      keyGated: true,
      itemCount: 0,
      lastError: `Set ${manifest.requiresKey} in .env.local to enable this source`,
    });
    return [];
  }

  const failures = store.failures.get(id) ?? 0;
  if (failures >= 5) {
    setStatus(id, manifest, {
      ok: false,
      health: "error",
      keyGated: false,
      itemCount: store.cache.get(id)?.items.length ?? 0,
      lastError: "Circuit open — too many consecutive failures",
      stale: true,
    });
    return store.cache.get(id)?.items ?? [];
  }

  const cached = store.cache.get(id);
  const fresh = cached && Date.now() - cached.at < manifest.scheduleSeconds * 1000;
  if (cached && fresh) {
    setStatus(id, manifest, {
      ok: true,
      health: "healthy",
      keyGated: false,
      itemCount: cached.items.length,
      lastFetch: new Date(cached.at).toISOString(),
      stale: false,
    });
    return cached.items;
  }

  const started = Date.now();
  await trackConnectorRequest(id);

  try {
    let items = await collect();
    if (manifest.contentPolicy !== "full_cache") {
      items = items.map((it) => ({ ...it, body: undefined }));
    }
    if (manifest.contentPolicy === "metadata_only") {
      items = items.map((it) => ({ ...it, summary: undefined }));
    }

    store.cache.set(id, { at: Date.now(), items });
    store.failures.set(id, 0);

    setStatus(id, manifest, {
      ok: true,
      health: "healthy",
      keyGated: false,
      lastFetch: new Date().toISOString(),
      itemCount: items.length,
      latencyMs: Date.now() - started,
      stale: false,
    });

    ingestItems(items);
    enqueueIngestion({
      id: `${id}-${Date.now()}`,
      sourceId: id,
      provider: manifest.source,
      items,
    });

    await publish({ type: "connector.run", connectorId: id, module: manifest.module, itemCount: items.length });
    await recordConnectorRun({
      sourceId: id,
      status: "success",
      itemCount: items.length,
      latencyMs: Date.now() - started,
    }).catch(() => {});

    void evaluateAlerts(items).catch(() => {});

    return items;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store.failures.set(id, failures + 1);

    await publish({
      type: "connector.error",
      connectorId: id,
      module: manifest.module,
      error: msg,
    });

    const hasCache = Boolean(cached?.items.length);
    setStatus(id, manifest, {
      ok: hasCache,
      health: hasCache ? "degraded" : "error",
      keyGated: false,
      lastFetch: new Date().toISOString(),
      lastError: msg,
      itemCount: cached?.items.length ?? 0,
      latencyMs: Date.now() - started,
      stale: hasCache,
    });

    await recordConnectorRun({
      sourceId: id,
      status: "error",
      itemCount: cached?.items.length ?? 0,
      latencyMs: Date.now() - started,
      errorMessage: msg,
    }).catch(() => {});

    return cached?.items ?? [];
  }
}

export async function runConnectors(ids: string[]): Promise<Item[]> {
  const results = await Promise.all(ids.map(runConnector));
  return results
    .flat()
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}

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
  const out: ConnectorStatus[] = [];
  for (const [id, { manifest }] of connectors) {
    const existing = store.status.get(id);
    if (existing) {
      out.push(existing);
      continue;
    }
    const keyGated = Boolean(manifest.requiresKey && !process.env[manifest.requiresKey]);
    out.push({
      id,
      module: manifest.module,
      source: manifest.source,
      ok: false,
      health: keyGated ? "key_gated" : "unknown",
      keyGated,
      itemCount: 0,
      provider: manifest.source,
    });
  }
  return out.sort((a, b) => a.module.localeCompare(b.module));
}
