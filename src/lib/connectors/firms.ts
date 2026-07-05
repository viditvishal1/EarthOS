import type { Item } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/connectors/framework";
import { registerConnector } from "@/lib/connectors/framework";

/** NASA FIRMS active fire detections — requires NASA_FIRMS_MAP_KEY. */
async function fetchFirmsFires(): Promise<Item[]> {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim();
  if (!key) return [];

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`;
  const res = await fetchWithTimeout(url, { timeoutMs: 20000 });
  if (!res.ok) throw new Error(`firms_http_${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const latIdx = headers.indexOf("latitude");
  const lonIdx = headers.indexOf("longitude");
  const dateIdx = headers.findIndex((h) => h.includes("acq_date"));
  const timeIdx = headers.findIndex((h) => h.includes("acq_time"));

  const now = new Date().toISOString();
  const items: Item[] = [];

  for (let i = 1; i < Math.min(lines.length, 500); i++) {
    const cols = lines[i].split(",");
    const lat = Number(cols[latIdx]);
    const lon = Number(cols[lonIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const date = cols[dateIdx] ?? "";
    const time = cols[timeIdx] ?? "";
    items.push({
      id: `firms:${date}:${time}:${lat}:${lon}`,
      module: "earth",
      connectorId: "nasa-firms",
      title: `Active fire detection · ${date}`,
      summary: "NASA FIRMS VIIRS snapshot",
      source: "NASA FIRMS",
      timestamp: now,
      lat,
      lon,
      severity: 6,
      tags: ["fire", "firms"],
      entities: [{ name: "Fire detection", type: "event" }],
      contentPolicy: "metadata_only",
    });
  }

  return items;
}

registerConnector(
  {
    id: "nasa-firms",
    module: "earth",
    source: "NASA FIRMS",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
    scheduleSeconds: 600,
    contentPolicy: "metadata_only",
    entityTypes: ["event", "location"],
    requiresKey: "NASA_FIRMS_MAP_KEY",
  },
  fetchFirmsFires,
);

export const FIRMS_CONNECTOR_ID = "nasa-firms";
