// NOTAM connector — FAA / AviationWeather.gov NOTAM API (free, keyless).
// Surfaces active notices for major hub airports worldwide.

import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

const HUBS = [
  "KJFK", "KLAX", "KORD", "KATL", "KDEN", "KSFO", "KDFW", "KMIA", "KSEA", "KBOS",
  "EGLL", "LFPG", "EDDF", "EHAM", "LEMD", "LIRF", "OMDB", "VHHH", "WSSS", "RJTT",
  "VIDP", "VABB", "YSSY", "CYYZ",
];

interface NotamFeature {
  properties?: {
    coreNOTAMData?: {
      notam?: {
        id?: string;
        number?: string;
        location?: string;
        icaoLocation?: string;
        text?: string;
        effectiveStart?: string;
        effectiveEnd?: string;
      };
    };
  };
}

registerConnector(
  {
    id: "faa_notams",
    module: "aviation",
    source: "AviationWeather NOTAMs",
    sourceUrl: "https://aviationweather.gov",
    scheduleSeconds: 600,
    contentPolicy: "full_cache",
    entityTypes: ["location", "event"],
  },
  async () => {
    const res = await fetchWithTimeout(
      `https://aviationweather.gov/api/data/notam?ids=${HUBS.join(",")}&format=json`,
      { timeoutMs: 15000 },
    );
    if (!res.ok) throw new Error(`NOTAM API HTTP ${res.status}`);
    const data = await res.json();
    const features: NotamFeature[] = Array.isArray(data) ? data : data?.features ?? [];
    const items: Item[] = [];
    for (const f of features.slice(0, 80)) {
      const n = f.properties?.coreNOTAMData?.notam;
      if (!n?.text) continue;
      const loc = n.icaoLocation ?? n.location ?? "UNKNOWN";
      const text = n.text.replace(/\s+/g, " ").trim().slice(0, 800);
      items.push({
        id: `notam:${n.id ?? n.number ?? text.slice(0, 40)}`,
        module: "aviation",
        connectorId: "faa_notams",
        title: `${loc}: NOTAM ${n.number ?? ""}`.trim(),
        summary: text.slice(0, 280),
        body: text,
        source: "AviationWeather NOTAMs",
        url: `https://aviationweather.gov/notam/?ids=${loc}`,
        timestamp: n.effectiveStart ? new Date(n.effectiveStart).toISOString() : new Date().toISOString(),
        severity: 4,
        severityLabel: "NOTAM",
        tags: ["notam", "airport"],
        region: loc.startsWith("K") ? "United States" : "Global",
        entities: [{ name: loc, type: "location" }],
        contentPolicy: "full_cache",
      });
    }
    return items;
  },
);

export const NOTAM_CONNECTOR_IDS = ["faa_notams"];
