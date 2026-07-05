// Module registry — drives navigation, accent colors, and global search scope.
// Accent families per the design system: cyber = red/amber, disaster = orange,
// markets = green, aviation/maritime = blue, space = violet.

export interface ModuleDef {
  id: string;
  name: string;
  path: string;
  description: string;
  accent: string; // tailwind color token used for chips/badges
}

export const MODULES: ModuleDef[] = [
  { id: "earth", name: "Earth View", path: "/earth", description: "Live map: earthquakes, wildfires, storms, flights, ISS", accent: "orange" },
  { id: "news", name: "News Intelligence", path: "/news", description: "In-app reader, clustering, AI summaries", accent: "sky" },
  { id: "conflict", name: "Conflict & Crisis", path: "/conflict", description: "Armed conflict, political violence, humanitarian crises on a live map", accent: "red" },
  { id: "live", name: "Live Channels", path: "/live", description: "Live news TV and public city webcams, grid or focus view", accent: "pink" },
  { id: "macro", name: "Macro Economics", path: "/macro", description: "GDP, inflation, rates, energy prices — fundamental context", accent: "emerald" },
  { id: "cyber", name: "Cyber Intelligence", path: "/cyber", description: "CVE / KEV tracking, watchlists, advisories", accent: "red" },
  { id: "aviation", name: "Aviation", path: "/aviation", description: "Live flights, airport status", accent: "blue" },
  { id: "maritime", name: "Maritime", path: "/maritime", description: "Vessel tracking, shipping signals", accent: "cyan" },
  { id: "space", name: "Space", path: "/space", description: "ISS, launches, satellites, space weather", accent: "violet" },
  { id: "markets", name: "Markets", path: "/markets", description: "Stocks, indices, crypto with in-app charts", accent: "green" },
  { id: "startup", name: "Startup Intelligence", path: "/startup", description: "GitHub trending, Hacker News launches", accent: "amber" },
  { id: "government", name: "Government & Legal", path: "/government", description: "Federal Register, courts, open data", accent: "stone" },
  { id: "infrastructure", name: "Infrastructure", path: "/infrastructure", description: "Internet & platform health", accent: "teal" },
  { id: "city", name: "City Digital Twin", path: "/city", description: "Per-city composite intelligence view", accent: "indigo" },
  { id: "graph", name: "Knowledge Graph", path: "/graph", description: "Cross-module entity explorer", accent: "fuchsia" },
  { id: "investigations", name: "Investigations", path: "/investigations", description: "Evidence workspaces, notes, cited exports", accent: "rose" },
  { id: "analyst", name: "AI Analyst", path: "/analyst", description: "Natural-language cross-module Q&A", accent: "purple" },
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id);
