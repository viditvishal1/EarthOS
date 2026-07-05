/** Geographic helpers for entity route / bearing visualization on the map. */

/** Project a point along a bearing for `distanceKm` (great-circle). Returns [lon, lat]. */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const d = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

export interface TrackPoint {
  lat: number;
  lon: number;
  observedAt?: string;
}

/** Build a polyline from history points or a short heading projection. */
export function buildEntityTrackLine(input: {
  lat: number;
  lon: number;
  heading?: number | null;
  history?: TrackPoint[];
  /** km to project when only heading is known (default 80). */
  projectKm?: number;
}): [number, number][] {
  const history = (input.history ?? []).filter(
    (p) => typeof p.lat === "number" && typeof p.lon === "number",
  );
  if (history.length >= 2) {
    return history.map((p) => [p.lon, p.lat] as [number, number]);
  }

  const coords: [number, number][] = [[input.lon, input.lat]];

  if (typeof input.heading === "number" && Number.isFinite(input.heading)) {
    const km = input.projectKm ?? 80;
    const [lon2, lat2] = destinationPoint(input.lat, input.lon, input.heading, km);
    coords.push([lon2, lat2]);
  }

  return coords;
}
