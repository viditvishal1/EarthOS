import type { VariantDefinition, VariantId } from "@/lib/variants/types";

const WORLD_PANELS = [
  "globe-map", "event-timeline", "wire-headlines", "conflict-events",
  "markets-snapshot", "aviation-status", "cameras", "my-monitors", "provider-health",
];

const WORLD_LAYERS = [
  "flights", "events", "quakes", "iss", "ships", "cctv", "satellites", "conflict",
];

const WORLD_MODULES = [
  "earth", "dashboard", "news", "conflict", "live", "cyber", "aviation",
  "maritime", "space", "graph", "investigations", "analyst",
];

export const VARIANT_REGISTRY: VariantDefinition[] = [
  {
    id: "world",
    label: "World",
    description: "Geopolitical OSINT — crisis monitoring, live map, conflict and convergence intelligence",
    panels: WORLD_PANELS,
    mapLayers: WORLD_LAYERS,
    modules: WORLD_MODULES,
    themeAccent: "sky",
    defaultPath: "/",
    enabled: true,
  },
  {
    id: "finance",
    label: "Finance",
    description: "Markets, macro, regime signals — post-MVP",
    panels: ["markets-snapshot", "wire-headlines", "my-monitors"],
    mapLayers: [],
    modules: ["markets", "macro"],
    themeAccent: "emerald",
    defaultPath: "/markets",
    enabled: false,
  },
  {
    id: "tech",
    label: "Tech",
    description: "Startup and cyber intelligence — post-MVP",
    panels: ["wire-headlines", "my-monitors"],
    mapLayers: [],
    modules: ["startup", "cyber"],
    themeAccent: "violet",
    defaultPath: "/startup",
    enabled: false,
  },
  {
    id: "commodity",
    label: "Commodity",
    description: "Energy and supply-chain commodities — post-MVP",
    panels: ["markets-snapshot"],
    mapLayers: ["ships"],
    modules: ["maritime", "macro"],
    themeAccent: "amber",
    defaultPath: "/maritime",
    enabled: false,
  },
  {
    id: "energy",
    label: "Energy",
    description: "Oil, gas and infrastructure — post-MVP",
    panels: ["markets-snapshot", "globe-map"],
    mapLayers: ["ships", "events"],
    modules: ["macro", "infrastructure"],
    themeAccent: "orange",
    defaultPath: "/macro",
    enabled: false,
  },
  {
    id: "happy",
    label: "Happy",
    description: "Positive global signals — post-MVP",
    panels: ["wire-headlines"],
    mapLayers: [],
    modules: ["news"],
    themeAccent: "pink",
    defaultPath: "/news",
    enabled: false,
  },
];

const byId = new Map(VARIANT_REGISTRY.map((v) => [v.id, v]));

export function getVariant(id: string): VariantDefinition {
  return byId.get(id as VariantId) ?? byId.get("world")!;
}

export function listVariants(enabledOnly = false): VariantDefinition[] {
  return enabledOnly ? VARIANT_REGISTRY.filter((v) => v.enabled) : [...VARIANT_REGISTRY];
}

export const DEFAULT_VARIANT_ID: VariantId = "world";
