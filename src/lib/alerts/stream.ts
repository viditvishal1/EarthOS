import type { AlertEvent } from "@/lib/alerts/engine";

type Listener = (event: AlertEvent) => void;

const g = globalThis as unknown as { __argusAlertListeners?: Set<Listener> };
const listeners = (g.__argusAlertListeners ??= new Set());

export function subscribeAlertStream(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcastAlert(event: AlertEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* isolated */
    }
  }
}
