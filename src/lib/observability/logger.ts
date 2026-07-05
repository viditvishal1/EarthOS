const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*['"]?[a-zA-Z0-9_\-./+=]{8,}/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...sanitize(fields) }));
}

export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(JSON.stringify({ level: "warn", event, ts: new Date().toISOString(), ...sanitize(fields) }));
}

export function logError(event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  console.error(JSON.stringify({ level: "error", event, ts: new Date().toISOString(), ...sanitize(fields) }));
}

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "string") out[k] = redactSecrets(v);
    else out[k] = v;
  }
  return out;
}
