import type { Item } from "@/lib/types";
import type { Observation, ObservationCategory } from "@/lib/observations/types";
import { buildProvenanceFields } from "@/lib/ingest/provenance";

function categoryFromItem(item: Item): ObservationCategory {
  if (item.tags.includes("earthquake")) return "earthquake";
  if (item.tags.includes("fire") || item.tags.includes("firms")) return "fire";
  if (item.module === "conflict" || item.tags.includes("conflict")) return "conflict";
  if (item.module === "cyber") return "cyber";
  if (item.module === "aviation" || item.tags.includes("flight")) return "aviation";
  if (item.module === "maritime") return "maritime";
  if (item.module === "macro" || item.module === "markets") return "macro";
  if (item.module === "news" || item.tags.includes("gdelt")) return "news";
  return "other";
}

function geocodeMeta(item: Item): Pick<Observation["provenance"], "geocodeMethod" | "geocodeConfidence"> {
  if (typeof item.lat !== "number" || typeof item.lon !== "number") {
    return { geocodeMethod: "none", geocodeConfidence: 0 };
  }
  const explicit = item.extra?.geocodeMethod === "explicit" || item.tags.includes("geocoded");
  return {
    geocodeMethod: explicit ? "explicit" : "inferred",
    geocodeConfidence: explicit ? 0.9 : 0.5,
  };
}

export function itemToObservation(item: Item, providerId?: string): Observation {
  const fetchedAt = new Date().toISOString();
  const geo = geocodeMeta(item);
  const prov = buildProvenanceFields({
    providerId: providerId ?? item.connectorId,
    sourceRecordId: item.id,
    observedAt: item.timestamp,
    fetchedAt,
    licensePolicy: item.contentPolicy,
    attribution: item.source,
  });

  return {
    id: item.id,
    category: categoryFromItem(item),
    title: item.title,
    summary: item.summary,
    url: item.url,
    severity: item.severity,
    lat: item.lat,
    lng: item.lon,
    region: item.region,
    tags: item.tags,
    entities: item.entities,
    provenance: {
      providerId: prov.providerId,
      sourceRecordId: prov.sourceRecordId,
      observedAt: prov.observedAt,
      fetchedAt: prov.fetchedAt,
      licensePolicy: prov.licensePolicy,
      attribution: prov.attribution,
      ...geo,
    },
  };
}
