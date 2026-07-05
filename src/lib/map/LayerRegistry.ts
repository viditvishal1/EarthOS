/**
 * Typed map layer registry — renderer capabilities and data dependencies.
 */

export type MapLayerRenderer = "circle" | "symbol" | "cluster" | "line" | "heatmap";

export interface MapLayerDefinition {
  id: string;
  label: string;
  color: string;
  category: "aviation" | "maritime" | "space" | "crisis" | "earth" | "infra" | "media";
  renderer: MapLayerRenderer;
  dataDependencies: string[];
  defaultVisible: boolean;
  mobileDefault: boolean;
  attribution: string;
  refreshSeconds: number;
  coverage: string;
  snapshot?: boolean;
}

export const MAP_LAYER_REGISTRY: MapLayerDefinition[] = [
  {
    id: "flights",
    label: "Flights",
    color: "#39ff8f",
    category: "aviation",
    renderer: "symbol",
    dataDependencies: ["opensky", "adsb-lol"],
    defaultVisible: true,
    mobileDefault: false,
    attribution: "OpenSky / adsb.lol",
    refreshSeconds: 90,
    coverage: "Global sampled",
  },
  {
    id: "ships",
    label: "Ships",
    color: "#22d3ee",
    category: "maritime",
    renderer: "circle",
    dataDependencies: ["aishub", "aisstream"],
    defaultVisible: false,
    mobileDefault: false,
    attribution: "AISHub / AISStream",
    refreshSeconds: 120,
    coverage: "Receiver-dependent",
  },
  {
    id: "events",
    label: "Events",
    color: "#38bdf8",
    category: "crisis",
    renderer: "circle",
    dataDependencies: ["gdelt-doc", "reliefweb"],
    defaultVisible: true,
    mobileDefault: true,
    attribution: "GDELT / ReliefWeb",
    refreshSeconds: 600,
    coverage: "Global",
  },
  {
    id: "quakes",
    label: "Quakes",
    color: "#fb923c",
    category: "earth",
    renderer: "circle",
    dataDependencies: ["usgs-earthquakes"],
    defaultVisible: true,
    mobileDefault: true,
    attribution: "USGS",
    refreshSeconds: 300,
    coverage: "Global",
  },
  {
    id: "fires",
    label: "Fires",
    color: "#f97316",
    category: "earth",
    renderer: "cluster",
    dataDependencies: ["nasa-firms"],
    defaultVisible: false,
    mobileDefault: false,
    attribution: "NASA FIRMS",
    refreshSeconds: 600,
    coverage: "Global (key required)",
  },
  {
    id: "cctv",
    label: "CCTV",
    color: "#f472b6",
    category: "infra",
    renderer: "circle",
    dataDependencies: ["cctv-agencies"],
    defaultVisible: false,
    mobileDefault: false,
    attribution: "Agency open-data feeds",
    refreshSeconds: 300,
    coverage: "Regional",
    snapshot: true,
  },
  {
    id: "webcams",
    label: "Webcams",
    color: "#a78bfa",
    category: "media",
    renderer: "circle",
    dataDependencies: ["curated-webcams"],
    defaultVisible: false,
    mobileDefault: false,
    attribution: "Curated public streams",
    refreshSeconds: 86400,
    coverage: "Curated cities",
  },
  {
    id: "iss",
    label: "ISS",
    color: "#4ade80",
    category: "space",
    renderer: "symbol",
    dataDependencies: ["iss-position"],
    defaultVisible: true,
    mobileDefault: true,
    attribution: "wheretheiss.at",
    refreshSeconds: 120,
    coverage: "Single platform",
  },
];

const byId = new Map(MAP_LAYER_REGISTRY.map((l) => [l.id, l]));

export function getMapLayer(id: string): MapLayerDefinition | undefined {
  return byId.get(id);
}

export function listMapLayers(): MapLayerDefinition[] {
  return [...MAP_LAYER_REGISTRY];
}
