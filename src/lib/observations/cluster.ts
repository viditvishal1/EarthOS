import type { Observation, ObservationCluster } from "@/lib/observations/types";
import { canonicalUrlHash, headlineSimHash } from "@/lib/ingest/dedup";

function clusterKey(o: Observation): string {
  if (o.url) return `url:${canonicalUrlHash(o.url)}`;
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    return `geo:${o.category}:${headlineSimHash(o.title)}:${o.lat.toFixed(1)}:${o.lng.toFixed(1)}`;
  }
  return `headline:${headlineSimHash(o.title)}`;
}

export function clusterObservations(observations: Observation[]): ObservationCluster[] {
  const buckets = new Map<string, Observation[]>();

  for (const o of observations) {
    const k = clusterKey(o);
    const list = buckets.get(k) ?? [];
    list.push({ ...o, clusterId: k });
    buckets.set(k, list);
  }

  const clusters: ObservationCluster[] = [];
  for (const [id, members] of buckets) {
    members.sort((a, b) => b.provenance.observedAt.localeCompare(a.provenance.observedAt));
    const withGeo = members.filter((m) => typeof m.lat === "number" && typeof m.lng === "number");
    const centroid = withGeo.length
      ? {
          lat: withGeo.reduce((s, m) => s + m.lat!, 0) / withGeo.length,
          lng: withGeo.reduce((s, m) => s + m.lng!, 0) / withGeo.length,
        }
      : undefined;

    clusters.push({
      id,
      canonicalTitle: members[0].title,
      memberCount: members.length,
      sources: [...new Set(members.map((m) => m.provenance.attribution))],
      latestAt: members[0].provenance.observedAt,
      observations: members,
      centroid,
    });
  }

  return clusters.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}
