/** Unified map layer catalog (G03) — shared across Earth View and Globe Dashboard. */

import type { Item } from "@/lib/types";
import type { MapLayer } from "@/components/MapView";

export interface LayerData {
  events: Item[];
  quakes: Item[];
  iss: Item[];
  flights: Item[];
  ships: Item[];
  webcams: Item[];
  cctv: Item[];
  fires: Item[];
  advisories: Item[];
  sanctions: Item[];
  conflicts: Item[];
  cyber: Item[];
  forecasts: Item[];
  predictions: Item[];
  infrastructure: Item[];
  satellites: Item[];
  nuclear: Item[];
  pipelines: Item[];
  cables: Item[];
  ports: Item[];
  chokepoints: Item[];
  volcanoes: Item[];
  spaceports: Item[];
  refineries: Item[];
  outages: Item[];
  airports: Item[];
  notams: Item[];
  outbreaks: Item[];
  energy: Item[];
  patents: Item[];
  startups: Item[];
  gdelt: Item[];
}

export const LAYER_CATALOG = {
  events: { label: "Events", color: "#38bdf8", defaultOn: true, maxItems: 300, radius: 4 },
  quakes: { label: "Quakes", color: "#fb923c", defaultOn: true, maxItems: 150, radius: 3 },
  iss: { label: "ISS", color: "#4ade80", defaultOn: true, maxItems: 5, radius: 6 },
  flights: { label: "Flights", color: "#39ff8f", defaultOn: true, maxItems: 2000, radius: 2, icon: "plane" as const },
  ships: { label: "Ships", color: "#22d3ee", defaultOn: true, maxItems: 500, radius: 3 },
  webcams: { label: "Webcams", color: "#a78bfa", defaultOn: false, maxItems: 200, radius: 4 },
  cctv: { label: "CCTV", color: "#f472b6", defaultOn: false, maxItems: 200, radius: 4 },
  fires: { label: "Fires", color: "#ef4444", defaultOn: false, maxItems: 400, radius: 3 },
  advisories: { label: "Advisories", color: "#f59e0b", defaultOn: false, maxItems: 50, radius: 5 },
  sanctions: { label: "Sanctions", color: "#dc2626", defaultOn: false, maxItems: 30, radius: 5 },
  conflicts: { label: "Conflict", color: "#b91c1c", defaultOn: false, maxItems: 200, radius: 4 },
  cyber: { label: "Cyber", color: "#8b5cf6", defaultOn: false, maxItems: 100, radius: 3 },
  forecasts: { label: "Forecasts", color: "#06b6d4", defaultOn: false, maxItems: 20, radius: 5 },
  predictions: { label: "Predictions", color: "#10b981", defaultOn: false, maxItems: 40, radius: 4 },
  infrastructure: { label: "Infra", color: "#64748b", defaultOn: false, maxItems: 100, radius: 3 },
  satellites: { label: "Satellites", color: "#c084fc", defaultOn: false, maxItems: 50, radius: 3 },
  nuclear: { label: "Nuclear", color: "#eab308", defaultOn: false, maxItems: 50, radius: 5 },
  pipelines: { label: "Pipelines", color: "#78716c", defaultOn: false, maxItems: 30, radius: 4 },
  cables: { label: "Cables", color: "#0ea5e9", defaultOn: false, maxItems: 30, radius: 4 },
  ports: { label: "Ports", color: "#2563eb", defaultOn: false, maxItems: 40, radius: 4 },
  chokepoints: { label: "Chokepoints", color: "#f97316", defaultOn: false, maxItems: 20, radius: 6 },
  volcanoes: { label: "Volcanoes", color: "#dc2626", defaultOn: false, maxItems: 30, radius: 5 },
  spaceports: { label: "Spaceports", color: "#a855f7", defaultOn: false, maxItems: 20, radius: 5 },
  refineries: { label: "Refineries", color: "#57534e", defaultOn: false, maxItems: 30, radius: 4 },
  outages: { label: "Outages", color: "#f43f5e", defaultOn: false, maxItems: 50, radius: 5 },
  airports: { label: "Airports", color: "#3b82f6", defaultOn: false, maxItems: 50, radius: 4 },
  notams: { label: "NOTAMs", color: "#fbbf24", defaultOn: false, maxItems: 80, radius: 4 },
  outbreaks: { label: "Outbreaks", color: "#84cc16", defaultOn: false, maxItems: 40, radius: 5 },
  energy: { label: "Energy", color: "#ca8a04", defaultOn: false, maxItems: 40, radius: 4 },
  patents: { label: "Patents", color: "#6366f1", defaultOn: false, maxItems: 40, radius: 3 },
  startups: { label: "Startups", color: "#14b8a6", defaultOn: false, maxItems: 40, radius: 3 },
  gdelt: { label: "GDELT", color: "#38bdf8", defaultOn: false, maxItems: 80, radius: 3 },
} as const;

export type LayerKey = keyof typeof LAYER_CATALOG;

export function defaultLayerToggles(): Record<LayerKey, boolean> {
  return Object.fromEntries(
    (Object.keys(LAYER_CATALOG) as LayerKey[]).map((k) => [k, LAYER_CATALOG[k].defaultOn]),
  ) as Record<LayerKey, boolean>;
}

export function buildMapLayers(
  data: LayerData,
  toggles: Record<LayerKey, boolean>,
  isolate: LayerKey | null,
): MapLayer[] {
  const active = (key: LayerKey) => (isolate ? isolate === key : toggles[key]);
  const out: MapLayer[] = [];

  for (const key of Object.keys(LAYER_CATALOG) as LayerKey[]) {
    if (!active(key)) continue;
    const meta = LAYER_CATALOG[key];
    const items = data[key].slice(0, meta.maxItems);
    if (!items.length) continue;
    out.push({
      id: key,
      color: meta.color,
      items,
      radius: meta.radius,
      ...("icon" in meta && meta.icon ? { icon: meta.icon } : {}),
    });
  }
  return out;
}

export function allLayerItems(data: LayerData): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const key of Object.keys(LAYER_CATALOG) as LayerKey[]) {
    for (const item of data[key]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}
