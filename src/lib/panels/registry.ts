import type { PanelDefinition } from "@/lib/panels/types";

export const PANEL_REGISTRY: PanelDefinition[] = [
  {
    key: "globe-map",
    title: "Global Map",
    category: "map",
    componentId: "globe-map",
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 6, h: 4 },
    dataDependencies: ["opensky", "usgs-earthquakes", "cctv-agencies"],
    supportedLayers: ["flights", "events", "quakes", "cctv", "ships", "iss"],
    mobile: "enabled",
    description: "Multi-layer MapLibre globe with live toggles",
  },
  {
    key: "live-news",
    title: "Live News",
    category: "news",
    componentId: "live-news",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    dataDependencies: ["gdelt-doc", "reliefweb"],
    mobile: "collapsed",
  },
  {
    key: "wire-headlines",
    title: "Wire",
    category: "news",
    componentId: "wire-headlines",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    dataDependencies: ["gdelt-doc", "reliefweb"],
    mobile: "collapsed",
  },
  {
    key: "markets-snapshot",
    title: "Markets",
    category: "markets",
    componentId: "markets-snapshot",
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    dataDependencies: ["world-bank", "fred"],
    mobile: "collapsed",
  },
  {
    key: "cameras",
    title: "Traffic Cameras",
    category: "system",
    componentId: "cameras",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    dataDependencies: ["cctv-agencies"],
    mobile: "disabled",
  },
  {
    key: "conflict-events",
    title: "Conflict Events",
    category: "crisis",
    componentId: "conflict-events",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    dataDependencies: ["ucdp", "acled", "gdelt-doc"],
    mobile: "collapsed",
  },
  {
    key: "aviation-status",
    title: "Aviation",
    category: "aviation",
    componentId: "aviation-status",
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    dataDependencies: ["opensky", "faa-nas"],
    mobile: "collapsed",
  },
  {
    key: "provider-health",
    title: "Data Sources",
    category: "system",
    componentId: "provider-health",
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    dataDependencies: [],
    mobile: "disabled",
  },
];

const byKey = new Map(PANEL_REGISTRY.map((p) => [p.key, p]));

export function getPanel(key: string): PanelDefinition | undefined {
  return byKey.get(key);
}

export function listPanels(category?: PanelDefinition["category"]): PanelDefinition[] {
  return category ? PANEL_REGISTRY.filter((p) => p.category === category) : [...PANEL_REGISTRY];
}
