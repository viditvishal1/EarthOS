// Event bus — in-process pub/sub by default; publishes to Upstash Redis when
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured.

import { dbEnabled, logEvent } from "@/lib/db";

export type EarthEvent = {
  type: "connector.run" | "connector.error" | "ingest.received" | "article.cached";
  connectorId?: string;
  module?: string;
  itemCount?: number;
  error?: string;
  at: string;
  meta?: Record<string, unknown>;
};

type Handler = (ev: EarthEvent) => void;

const g = globalThis as unknown as { __earthosBus?: { handlers: Set<Handler> } };
const bus = (g.__earthosBus ??= { handlers: new Set() });

export function subscribe(handler: Handler): () => void {
  bus.handlers.add(handler);
  return () => bus.handlers.delete(handler);
}

export async function publish(ev: Omit<EarthEvent, "at">): Promise<void> {
  const full: EarthEvent = { ...ev, at: new Date().toISOString() };
  for (const h of bus.handlers) {
    try { h(full); } catch { /* isolated */ }
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      await fetch(`${url}/lpush/earthos:events/${encodeURIComponent(JSON.stringify(full))}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* best-effort */ }
  }

  if (dbEnabled()) {
    await logEvent(full.type, full as unknown as Record<string, unknown>);
  }
}
