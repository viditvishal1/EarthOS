/** USGS GeoJSON feature — minimal runtime validation. */

export type UsgsFeature = {
  id: string;
  properties: {
    mag?: number | null;
    place?: string;
    time?: number;
    url?: string;
    title?: string;
  };
  geometry?: { type: string; coordinates?: [number, number, number?] };
};

export function isUsgsFeature(input: unknown): input is UsgsFeature {
  if (!input || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (!o.properties || typeof o.properties !== "object") return false;
  const p = o.properties as Record<string, unknown>;
  if (p.time != null && typeof p.time !== "number") return false;
  return true;
}

export function parseUsgsCollection(input: unknown): UsgsFeature[] {
  if (!input || typeof input !== "object") return [];
  const features = (input as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.filter(isUsgsFeature);
}
