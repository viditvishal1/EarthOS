import { readModuleLiveCached } from "@/lib/live/module-cache";
import { readLiveCached, seedLiveSafe } from "@/lib/live/store";
import { itemToObservation } from "@/lib/observations/normalize";
import { clusterObservations } from "@/lib/observations/cluster";
import type { Observation, ObservationCategory, ObservationCluster } from "@/lib/observations/types";
import type { Item } from "@/lib/types";

const OBS_KEY = "observations:recent";
const OBS_TTL = 600;
const SOURCE = "news/conflict/earth modules";

export interface ObservationQuery {
  bbox?: [number, number, number, number];
  from?: string;
  to?: string;
  category?: ObservationCategory;
  severityMin?: number;
  source?: string;
  cluster?: boolean;
  limit?: number;
}

async function loadRawItems(): Promise<Item[]> {
  const modules = ["news", "conflict", "earth"] as const;
  const parts = await Promise.all(modules.map((m) => readModuleLiveCached(m)));
  return parts.flatMap((p) => p?.data ?? []);
}

export async function seedObservationsBundle(): Promise<number> {
  const items = await loadRawItems();
  const observations = items.map((i) => itemToObservation(i));
  if (observations.length === 0) return 0;
  const write = await seedLiveSafe(OBS_KEY, observations, SOURCE);
  return write.ok ? observations.length : 0;
}

export async function getObservations(query: ObservationQuery = {}): Promise<{
  observations: Observation[];
  clusters?: ObservationCluster[];
  stale: boolean;
  cold: boolean;
  updatedAt: string | null;
}> {
  let cached = await readLiveCached<Observation[]>(OBS_KEY, {
    ttlSeconds: OBS_TTL,
    source: SOURCE,
    fallback: [],
  });

  if (cached.cold || cached.data.length === 0) {
    const items = await loadRawItems();
    const observations = items.map((i) => itemToObservation(i));
    if (observations.length > 0) {
      await seedLiveSafe(OBS_KEY, observations, SOURCE);
      cached = { ...cached, data: observations, cold: false, stale: false, updatedAt: new Date().toISOString() };
    }
  }

  let list = cached.data;

  if (query.category) list = list.filter((o) => o.category === query.category);
  if (query.severityMin != null) list = list.filter((o) => (o.severity ?? 0) >= query.severityMin!);
  if (query.source) list = list.filter((o) => o.provenance.attribution.toLowerCase().includes(query.source!.toLowerCase()));
  if (query.from) list = list.filter((o) => o.provenance.observedAt >= query.from!);
  if (query.to) list = list.filter((o) => o.provenance.observedAt <= query.to!);
  if (query.bbox) {
    const [west, south, east, north] = query.bbox;
    list = list.filter(
      (o) => typeof o.lat === "number" && typeof o.lng === "number"
        && o.lng >= west && o.lng <= east && o.lat >= south && o.lat <= north,
    );
  }

  const limit = query.limit ?? 200;
  list = list.slice(0, limit);

  if (query.cluster) {
    const clusters = clusterObservations(list).slice(0, Math.min(100, limit));
    return {
      observations: list,
      clusters,
      stale: cached.stale,
      cold: cached.cold,
      updatedAt: cached.updatedAt,
    };
  }

  return {
    observations: list,
    stale: cached.stale,
    cold: cached.cold,
    updatedAt: cached.updatedAt,
  };
}
