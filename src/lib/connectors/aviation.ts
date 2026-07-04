// Aviation connectors — OpenSky Network live states (anonymous free tier,
// bbox-limited to keep payloads small) + FAA airspace system status.

import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

// Each region has a bbox (for OpenSky) and a set of probe points (for the
// adsb.lol fallback, which queries a 250 nm radius per point). "global"
// has no bbox — it is served purely by probes at the world's traffic hubs.
// World probe grid — adsb.lol queries 250 nm (~463 km) per point. Dense hubs
// plus a coarse lat/lon grid so Global view covers India, China, Africa, etc.
function gridProbes(stepDeg: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let lat = -55; lat <= 72; lat += stepDeg) {
    for (let lon = -175; lon <= 175; lon += stepDeg) {
      if (Math.abs(lat) < 8 && Math.abs(lon) > 150) continue; // sparse empty Pacific
      pts.push([lat, lon]);
    }
  }
  return pts;
}

const HUB_PROBES: [number, number][] = [
  // Europe
  [50, 9], [51.5, 0], [41, -4], [59, 18], [38, 23], [48, 2], [55, 37], [45.5, 9.2],
  // North America
  [40.7, -74], [33.7, -84.4], [41.9, -87.6], [32.9, -97], [34, -118], [47.4, -122.3],
  [39.8, -104.9], [25.8, -80.3], [45.5, -73.6], [19.4, -99.1], [49.2, -123.1],
  // Latin America
  [-23.4, -46.5], [4.7, -74], [-34.6, -58.4], [-12, -77], [-33.4, -70.7],
  // India & South Asia
  [28.6, 77.2], [19.1, 72.9], [13, 77.6], [22.6, 88.4], [17.2, 78.4], [24.9, 67.2],
  [26.8, 80.9], [23, 72.6], [30.7, 76.8], [15.4, 73.8], [27.2, 78], [21.2, 81.6],
  [25.6, 85.1], [34.1, 74.8], [27.7, 85.3], [8.5, 76.9],
  // China & East Asia
  [31.2, 121.5], [22.3, 113.9], [35.5, 139.8], [37.5, 126.8], [39.5, 116.4], [25, 121.2],
  [30.6, 114.3], [34.3, 108.9], [36.7, 117], [43.9, 125.3], [45.8, 126.5], [38, 114.5],
  [23.1, 113.3], [29.6, 106.5], [26.6, 106.7], [36, 103.8], [41.8, 123.4],
  // Southeast Asia & Oceania
  [1.35, 103.99], [13.7, 100.75], [-6.1, 106.7], [-33.9, 151.2], [-37.7, 144.8],
  [14.6, 121], [-1.3, 116.9], [3.1, 101.7], [21, 105.8], [-27.5, 153],
  // Middle East
  [25.2, 55.3], [26.3, 50.6], [30, 31.4], [41, 29], [24.4, 54.6], [21.7, 39.2],
  [33.3, 44.4], [32, 34.8], [24.7, 46.7],
  // Africa
  [-26.1, 28.2], [6.6, 3.3], [-33.9, 18.4], [-1.3, 36.8], [30, 31.2], [9.1, 7.4],
  [5.6, -0.2], [-4.3, 15.3], [14.7, -17.4], [33.6, -7.6], [-15.4, 28.3], [0.3, 32.6],
  [-6.2, 35.7], [11.5, 43.1], [-25.7, 28.2], [36.8, 10.2],
  // Russia / Central Asia
  [55.8, 37.6], [59.9, 30.3], [43.2, 76.9], [51.2, 71.4], [62, 129.7],
];

function dedupeProbes(probes: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  return probes.filter(([lat, lon]) => {
    const k = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const GLOBAL_PROBES = dedupeProbes([...HUB_PROBES, ...gridProbes(22)]);

export const REGIONS: Record<
  string,
  { label: string; bbox?: [number, number, number, number]; probes: [number, number][] }
> = {
  global: {
    label: "Global",
    probes: GLOBAL_PROBES,
  },
  europe: {
    label: "Europe",
    bbox: [35, -12, 62, 32],
    probes: [[50, 9], [51.5, 0], [41, -4], [59, 18], [38, 23], [52.2, 21], [45.5, 9.2]],
  },
  usa: {
    label: "United States",
    bbox: [24, -126, 50, -66],
    probes: [[40.7, -74], [33.7, -84.4], [41.9, -87.6], [32.9, -97], [34, -118], [47.4, -122.3], [39.8, -104.9], [25.8, -80.3]],
  },
  india: {
    label: "India / South Asia",
    bbox: [5, 65, 37, 95],
    probes: [[28.6, 77.2], [19.1, 72.9], [13, 77.6], [22.6, 88.4], [17.2, 78.4], [24.9, 67.2]],
  },
  easia: {
    label: "East Asia",
    bbox: [18, 95, 48, 148],
    probes: [[31.2, 121.5], [22.3, 113.9], [35.5, 139.8], [37.5, 126.8], [39.5, 116.4], [25, 121.2]],
  },
  mideast: {
    label: "Middle East",
    bbox: [12, 32, 42, 65],
    probes: [[25.2, 55.3], [26.3, 50.6], [30, 31.4], [41, 29], [24.4, 54.6], [21.7, 39.2]],
  },
  africa: {
    label: "Africa",
    bbox: [-35, -18, 38, 52],
    probes: [[-26.1, 28.2], [6.6, 3.3], [-33.9, 18.4], [-1.3, 36.8], [30, 31.2], [9.1, 7.4], [5.6, -0.2], [-4.3, 15.3], [14.7, -17.4], [33.6, -7.6]],
  },
  china: {
    label: "China",
    bbox: [18, 73, 54, 135],
    probes: [[31.2, 121.5], [39.5, 116.4], [30.6, 114.3], [34.3, 108.9], [36.7, 117], [23.1, 113.3], [29.6, 106.5], [26.6, 106.7], [36, 103.8], [41.8, 123.4], [22.3, 113.9]],
  },
};

type OpenSkyState = [
  string, string | null, string, number | null, number,
  number | null, number | null, number | null, boolean,
  number | null, number | null, ...unknown[],
];

async function fetchOpenSky(region: string): Promise<Item[]> {
  const r = REGIONS[region] ?? REGIONS.europe;
  if (!r.bbox) throw new Error("no bbox for this region — use probes");
  const [lamin, lomin, lamax, lomax] = r.bbox;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
  const data = await res.json();
  const states: OpenSkyState[] = data.states ?? [];
  if (states.length === 0) throw new Error("OpenSky returned no aircraft");
  return states
    .filter((s) => s[5] != null && s[6] != null && !s[8])
    .slice(0, 500)
    .map((s): Item => {
      const callsign = (s[1] ?? "").trim() || s[0].toUpperCase();
      const airlinePrefix = callsign.match(/^[A-Z]{3}/)?.[0];
      return {
        id: `flight:${s[0]}`,
        module: "aviation",
        connectorId: "opensky_states",
        title: callsign,
        summary: `${callsign} · ${s[2]} · alt ${s[7] ? Math.round(s[7]) + " m" : "n/a"} · ${s[9] ? Math.round((s[9] as number) * 3.6) + " km/h" : ""}`,
        source: "OpenSky Network",
        url: `https://opensky-network.org/aircraft-profile?icao24=${s[0]}`,
        timestamp: new Date((s[4] as number) * 1000).toISOString(),
        lat: s[6] as number,
        lon: s[5] as number,
        tags: ["flight", r.label.toLowerCase()],
        region: r.label,
        entities: airlinePrefix
          ? [{ name: airlinePrefix, type: "organization" }, { name: callsign, type: "aircraft" }]
          : [{ name: callsign, type: "aircraft" }],
        contentPolicy: "full_cache",
        extra: {
          icao24: s[0],
          originCountry: s[2],
          altitudeM: s[7],
          velocityMs: s[9],
          heading: s[10],
        },
      };
    });
}

interface AdsbAircraft {
  hex: string; flight?: string; r?: string; t?: string;
  lat?: number; lon?: number; alt_baro?: number | "ground";
  gs?: number; track?: number;
}

/**
 * Fallback: adsb.lol — a free, keyless community ADS-B aggregator that is not
 * IP-throttled the way OpenSky's anonymous tier is (which matters on shared
 * serverless egress IPs like Vercel's). Queries a radius around each region's
 * center; several probe points approximate the region bbox.
 */
async function fetchAdsbLol(region: string): Promise<Item[]> {
  const r = REGIONS[region] ?? REGIONS.europe;
  const seen = new Map<string, AdsbAircraft>();
  const batchSize = region === "global" ? 14 : 10;

  for (let i = 0; i < r.probes.length; i += batchSize) {
    const batch = r.probes.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async ([lat, lon]) => {
        const res = await fetchWithTimeout(
          `https://api.adsb.lol/v2/lat/${lat.toFixed(2)}/lon/${lon.toFixed(2)}/dist/250`,
          { timeoutMs: 12000 },
        );
        if (!res.ok) throw new Error(`adsb.lol HTTP ${res.status}`);
        const data = await res.json();
        return (data.ac ?? []) as AdsbAircraft[];
      }),
    );
    for (const p of results) {
      if (p.status !== "fulfilled") continue;
      for (const ac of p.value) {
        if (ac.lat == null || ac.lon == null || ac.alt_baro === "ground") continue;
        seen.set(ac.hex, ac);
      }
    }
  }

  if (seen.size === 0) throw new Error("adsb.lol returned no aircraft");
  const limit = region === "global" ? 8000 : 4000;
  return [...seen.values()].slice(0, limit).map((ac): Item => {
    const callsign = (ac.flight ?? "").trim() || ac.r || ac.hex.toUpperCase();
    const airlinePrefix = callsign.match(/^[A-Z]{3}/)?.[0];
    return {
      id: `flight:${ac.hex}`,
      module: "aviation",
      connectorId: "opensky_states",
      title: callsign,
      summary: `${callsign}${ac.t ? ` · ${ac.t}` : ""} · alt ${typeof ac.alt_baro === "number" ? Math.round(ac.alt_baro) + " ft" : "n/a"}${ac.gs ? ` · ${Math.round(ac.gs * 1.852)} km/h` : ""}`,
      source: "adsb.lol",
      url: `https://globe.adsb.lol/?icao=${ac.hex}`,
      timestamp: new Date().toISOString(),
      lat: ac.lat,
      lon: ac.lon,
      tags: ["flight", r.label.toLowerCase()],
      region: r.label,
      entities: airlinePrefix
        ? [{ name: airlinePrefix, type: "organization" }, { name: callsign, type: "aircraft" }]
        : [{ name: callsign, type: "aircraft" }],
      contentPolicy: "full_cache",
      extra: {
        icao24: ac.hex,
        aircraftType: ac.t,
        registration: ac.r,
        altitudeFt: ac.alt_baro,
        heading: ac.track ?? 0,
      },
    };
  });
}

export async function fetchFlights(region: string): Promise<Item[]> {
  const r = REGIONS[region] ?? REGIONS.europe;
  if (!r.bbox) return fetchAdsbLol(region); // global: probes only
  try {
    return await fetchOpenSky(region);
  } catch {
    return await fetchAdsbLol(region);
  }
}

registerConnector(
  {
    id: "opensky_states",
    module: "aviation",
    source: "OpenSky Network",
    sourceUrl: "https://opensky-network.org",
    scheduleSeconds: 90,
    contentPolicy: "full_cache",
    entityTypes: ["aircraft", "organization"],
  },
  () => fetchFlights("europe"),
);

registerConnector(
  {
    id: "faa_status",
    module: "aviation",
    source: "FAA NAS Status",
    sourceUrl: "https://nasstatus.faa.gov",
    scheduleSeconds: 600,
    contentPolicy: "full_cache",
    entityTypes: ["location", "event"],
  },
  async () => {
    const res = await fetchWithTimeout("https://nasstatus.faa.gov/api/airport-status-information", {
      timeoutMs: 12000,
      headers: { Accept: "application/xml" },
    });
    if (!res.ok) throw new Error(`FAA HTTP ${res.status}`);
    const xml = await res.text();
    // The FAA feed is XML; extract delay entries with a tolerant regex scan
    // rather than a strict schema (the feed's structure varies by event type).
    const items: Item[] = [];
    const delayRe = /<Delay_type>[\s\S]*?<Name>([^<]+)<\/Name>([\s\S]*?)<\/Delay_type>/g;
    const airportRe = /<ARPT>([^<]+)<\/ARPT>|<Airport>([^<]+)<\/Airport>/g;
    let m: RegExpExecArray | null;
    while ((m = delayRe.exec(xml)) !== null) {
      const kind = m[1];
      const block = m[2];
      const airports = new Set<string>();
      let a: RegExpExecArray | null;
      while ((a = airportRe.exec(block)) !== null) airports.add(a[1] ?? a[2]);
      for (const code of airports) {
        items.push({
          id: `faa:${kind}:${code}`,
          module: "aviation",
          connectorId: "faa_status",
          title: `${code}: ${kind}`,
          summary: `FAA reports ${kind.toLowerCase()} affecting ${code}.`,
          source: "FAA NAS Status",
          url: "https://nasstatus.faa.gov",
          timestamp: new Date().toISOString(),
          severity: 5,
          severityLabel: kind,
          tags: ["airport-delay"],
          region: "United States",
          entities: [{ name: code, type: "location" }],
          contentPolicy: "full_cache",
        });
      }
    }
    return items;
  },
);

export const AVIATION_CONNECTOR_IDS = ["opensky_states", "faa_status", "faa_notams"];
