type Counter = { value: number; labels: Record<string, string> };

const g = globalThis as unknown as { __argusMetrics?: Map<string, Counter> };
const counters: Map<string, Counter> = (g.__argusMetrics ??= new Map());

function key(name: string, labels: Record<string, string>): string {
  const sorted = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`).join(",");
  return sorted ? `${name}{${sorted}}` : name;
}

export function incrementCounter(name: string, labels: Record<string, string> = {}, delta = 1): void {
  const k = key(name, labels);
  const prev = counters.get(k) ?? { value: 0, labels };
  prev.value += delta;
  counters.set(k, prev);
}

export function observeDuration(name: string, ms: number, labels: Record<string, string> = {}): void {
  incrementCounter(`${name}_ms_total`, labels, Math.round(ms));
  incrementCounter(`${name}_count`, labels, 1);
}

/** Prometheus text exposition (minimal counters). */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  for (const [k, c] of counters) {
    const labelStr = Object.entries(c.labels)
      .map(([lk, lv]) => `${lk}="${lv.replace(/"/g, '\\"')}"`)
      .join(",");
    const name = k.includes("{") ? k.slice(0, k.indexOf("{")) : k;
    lines.push(`# TYPE ${name} counter`);
    lines.push(labelStr ? `${name}{${labelStr}} ${c.value}` : `${name} ${c.value}`);
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

export function resetMetricsForTests(): void {
  counters.clear();
}
