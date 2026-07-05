import { fetchWithTimeout } from "@/lib/connectors/framework";
import { readLiveCached, seedLiveSafe } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import {
  getSatelliteGroup,
  listSatelliteGroups,
  type SatelliteGroupDefinition,
} from "@/lib/satellites/registry";
import {
  parseTleText,
  propagateBatch,
  type ParsedTle,
  type SatellitePosition,
} from "@/lib/satellites/tle";

export interface StoredTleMeta {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
  group: string;
  category: string;
  epochAgeHours: number;
  stale: boolean;
  fetchedAt: string;
}

export interface SatelliteGroupBundle {
  group: string;
  label: string;
  category: string;
  tleCount: number;
  tles: StoredTleMeta[];
  positions: SatellitePosition[];
  positionsPartial: boolean;
  fetchedAt: string;
  attribution: string;
}

const ATTRIBUTION = "CelesTrak / SGP4 (satellite.js)";

function tleDomain(group: string): string {
  return `satellites:tle:${group}`;
}

function positionsDomain(group: string): string {
  return `satellites:positions:${group}`;
}

export async function fetchTleFromCelesTrak(group: string): Promise<string> {
  const res = await fetchWithTimeout(
    `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`,
    { timeoutMs: 20000 },
  );
  if (!res.ok) throw new Error(`celestrak_http_${res.status}`);
  return res.text();
}

function toStoredMeta(t: ParsedTle, group: SatelliteGroupDefinition): StoredTleMeta {
  return {
    noradId: t.noradId,
    name: t.name,
    line1: t.line1,
    line2: t.line2,
    group: group.id,
    category: group.category,
    epochAgeHours: Math.round(t.epochAgeHours * 10) / 10,
    stale: t.stale,
    fetchedAt: new Date().toISOString(),
  };
}

export async function seedSatelliteGroup(groupId: string): Promise<{ count: number; positions: number }> {
  const group = getSatelliteGroup(groupId);
  if (!group) throw new Error(`unknown_group:${groupId}`);

  const text = await fetchTleFromCelesTrak(group.id);
  const cap = group.serverPropagateCap > 0 ? group.serverPropagateCap : 150;
  const parsed = parseTleText(text, cap);
  const metas = parsed.map((t) => toStoredMeta(t, group));

  await seedLiveSafe(tleDomain(group.id), metas, ATTRIBUTION);

  let positions: SatellitePosition[] = [];
  if (group.serverPropagateCap > 0) {
    positions = propagateBatch(parsed.slice(0, group.serverPropagateCap));
    await seedLiveSafe(positionsDomain(group.id), positions, ATTRIBUTION);
  }

  return { count: metas.length, positions: positions.length };
}

export async function seedDefaultSatellites(): Promise<{ groups: string[]; total: number }> {
  const groups = listSatelliteGroups().filter((g) => g.defaultForMap || g.serverPropagateCap > 0);
  let total = 0;
  const seeded: string[] = [];
  for (const g of groups) {
    try {
      const r = await seedSatelliteGroup(g.id);
      total += r.count;
      seeded.push(g.id);
    } catch {
      /* preserve LKG on failure */
    }
  }
  return { groups: seeded, total };
}

export async function readSatelliteGroupBundle(
  groupId: string,
  opts?: { includePositions?: boolean },
): Promise<SatelliteGroupBundle | null> {
  const group = getSatelliteGroup(groupId);
  if (!group) return null;

  const tleCache = await readLiveCached<StoredTleMeta[]>(tleDomain(group.id), {
    ttlSeconds: LIVE_SOFT_TTL.satellites,
    source: ATTRIBUTION,
    fallback: [],
  });

  let positions: SatellitePosition[] = [];
  let positionsPartial = false;

  if (opts?.includePositions !== false && group.serverPropagateCap > 0) {
    const posCache = await readLiveCached<SatellitePosition[]>(positionsDomain(group.id), {
      ttlSeconds: LIVE_SOFT_TTL.satellites,
      source: ATTRIBUTION,
      fallback: [],
    });
    positions = posCache.data;
    positionsPartial = tleCache.data.length > positions.length;
  } else if (tleCache.data.length > 0) {
    positionsPartial = true;
  }

  return {
    group: group.id,
    label: group.label,
    category: group.category,
    tleCount: tleCache.data.length,
    tles: tleCache.data,
    positions,
    positionsPartial,
    fetchedAt: tleCache.updatedAt ?? new Date().toISOString(),
    attribution: ATTRIBUTION,
  };
}

export async function readSatellitePositionsInBbox(
  bbox: [number, number, number, number],
  limit = 200,
): Promise<{ points: SatellitePosition[]; provider: string; partial: boolean }> {
  const [west, south, east, north] = bbox;
  const defaultGroup = listSatelliteGroups().find((g) => g.defaultForMap) ?? listSatelliteGroups()[0];
  const bundle = await readSatelliteGroupBundle(defaultGroup.id);
  if (!bundle) {
    return { points: [], provider: ATTRIBUTION, partial: false };
  }

  const points = bundle.positions.filter(
    (p) => p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north,
  ).slice(0, limit);

  return {
    points,
    provider: ATTRIBUTION,
    partial: bundle.positionsPartial || bundle.positions.length >= limit,
  };
}

export async function loadParsedTleForNorad(norad: string): Promise<ParsedTle | null> {
  for (const group of listSatelliteGroups()) {
    const cache = await readLiveCached<StoredTleMeta[]>(tleDomain(group.id), {
      ttlSeconds: LIVE_SOFT_TTL.satellites,
      source: ATTRIBUTION,
      fallback: [],
    });
    const hit = cache.data.find((t) => t.noradId === norad.replace(/\D/g, "").padStart(5, "0"));
    if (!hit) continue;
    const parsed = parseTleText(`${hit.name}\n${hit.line1}\n${hit.line2}`, 1);
    return parsed[0] ?? null;
  }

  try {
    const text = await fetchTleFromCelesTrak("stations");
    const parsed = parseTleText(text, 150);
    const { findTleByNorad } = await import("@/lib/satellites/tle");
    return findTleByNorad(parsed, norad) ?? null;
  } catch {
    return null;
  }
}
