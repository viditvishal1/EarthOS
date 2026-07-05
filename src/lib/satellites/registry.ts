export type SatelliteCategory =
  | "station"
  | "recent"
  | "navigation"
  | "weather"
  | "communications"
  | "science"
  | "debris";

export interface SatelliteGroupDefinition {
  id: string;
  label: string;
  category: SatelliteCategory;
  /** Max satellites to propagate on server (quota guard). */
  serverPropagateCap: number;
  defaultForMap: boolean;
}

export const SATELLITE_GROUPS: SatelliteGroupDefinition[] = [
  { id: "stations", label: "Space stations", category: "station", serverPropagateCap: 30, defaultForMap: true },
  { id: "last-30-days", label: "Launched < 30 days", category: "recent", serverPropagateCap: 50, defaultForMap: false },
  { id: "starlink", label: "Starlink", category: "communications", serverPropagateCap: 0, defaultForMap: false },
  { id: "gps-ops", label: "GPS constellation", category: "navigation", serverPropagateCap: 40, defaultForMap: false },
  { id: "weather", label: "Weather satellites", category: "weather", serverPropagateCap: 40, defaultForMap: false },
  { id: "active-geosynchronous", label: "Geosynchronous", category: "communications", serverPropagateCap: 40, defaultForMap: false },
];

const byId = new Map(SATELLITE_GROUPS.map((g) => [g.id, g]));

export function getSatelliteGroup(id: string): SatelliteGroupDefinition | undefined {
  return byId.get(id);
}

export function listSatelliteGroups(): SatelliteGroupDefinition[] {
  return [...SATELLITE_GROUPS];
}

export function isKnownSatelliteGroup(id: string): boolean {
  return byId.has(id);
}
