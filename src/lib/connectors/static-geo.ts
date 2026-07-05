/**
 * Static geospatial reference layers (G03) — nuclear, pipelines, cables, ports, etc.
 */

import type { Item } from "@/lib/types";
import { STATIC_GEO_POINTS, type StaticGeoCategory } from "@/lib/maps/static-geo";
import { registerConnector } from "./framework";

function staticItems(): Item[] {
  const now = new Date().toISOString();
  return STATIC_GEO_POINTS.map((p): Item => ({
    id: `static:${p.id}`,
    module: "earth",
    connectorId: "static_geo_reference",
    title: p.name,
    summary: `${p.category} reference point`,
    source: "Argus static geo index",
    timestamp: now,
    lat: p.lat,
    lon: p.lon,
    tags: ["static-geo", p.category, ...(p.region ? [p.region.toLowerCase()] : [])],
    region: p.region,
    entities: [{ name: p.name, type: "location" }],
    contentPolicy: "metadata_only" as const,
    extra: { category: p.category as StaticGeoCategory, layerKey: p.category },
  }));
}

registerConnector(
  {
    id: "static_geo_reference",
    module: "earth",
    source: "Argus static geo index",
    sourceUrl: "https://github.com/viditvishal1/Argus",
    scheduleSeconds: 86400,
    contentPolicy: "metadata_only",
    entityTypes: ["location"],
  },
  async () => staticItems(),
);

export const STATIC_GEO_CONNECTOR_ID = "static_geo_reference";
