/** Approximate map bounds from center + zoom (MapLibre web mercator). */

export interface MapBounds {
  lat: number;
  lon: number;
  zoom: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

export function bboxFromCenterZoom(lat: number, lon: number, zoom: number): MapBounds {
  const span = 360 / 2 ** Math.max(zoom, 0);
  const latSpan = Math.min(170, span * 0.55);
  const lonSpan = Math.min(360, span);
  return {
    lat,
    lon,
    zoom,
    west: lon - lonSpan / 2,
    east: lon + lonSpan / 2,
    south: Math.max(-85, lat - latSpan / 2),
    north: Math.min(85, lat + latSpan / 2),
  };
}
