const COOLDOWN_MS = 15 * 60 * 1000;

const g = globalThis as unknown as { __argusAlertDedup?: Map<string, number> };
const seen = (g.__argusAlertDedup ??= new Map());

export function isAlertDuplicate(key: string): boolean {
  const now = Date.now();
  const prev = seen.get(key);
  if (prev && now - prev < COOLDOWN_MS) return true;
  seen.set(key, now);
  if (seen.size > 5000) {
    for (const [k, t] of seen) {
      if (now - t > COOLDOWN_MS) seen.delete(k);
    }
  }
  return false;
}
