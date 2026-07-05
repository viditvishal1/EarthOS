import { createHash } from "crypto";

export function canonicalUrlHash(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    return createHash("sha256").update(u.toString().toLowerCase()).digest("hex");
  } catch {
    return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
  }
}

export function sourceIdKey(providerId: string, sourceRecordId: string): string {
  return `${providerId}:${sourceRecordId}`;
}

/** Rounded geohash-style bucket for event dedup (6 chars ~ ±0.6km at equator). */
export function geotemporalSignature(
  lat: number,
  lon: number,
  isoTime: string,
  category: string,
): string {
  const t = new Date(isoTime).getTime();
  const hourBucket = Math.floor(t / 3_600_000);
  const latR = (Math.round(lat * 100) / 100).toFixed(2);
  const lonR = (Math.round(lon * 100) / 100).toFixed(2);
  return createHash("sha256")
    .update(`${category}|${hourBucket}|${latR}|${lonR}`)
    .digest("hex")
    .slice(0, 16);
}

export function headlineSimHash(text: string): string {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const sorted = [...new Set(tokens)].sort().join(" ");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

export function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
