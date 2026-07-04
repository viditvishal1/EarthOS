// Aviation connectors — OpenSky Network live states (anonymous free tier,
// bbox-limited to keep payloads small) + FAA airspace system status.

import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

// Each region has a bbox (for OpenSky) and a set of probe points (for the
// adsb.lol fallback, which queries a 250 nm radius per point). "global"
// has no bbox — it is served purely by probes at the world's traffic hubs.
export const REGIONS: Record<
  string,
  { label: string; bbox?: [number, number, number, number]; probes: [number, number][] }
> = {
  global: {
    label: "Global",
    probes: [
      [50, 9], [51.5, 0], [41, -4], [59, 18], [38, 23],           // Europe
      [40.7, -74], [33.7, -84.4], [41.9, -87.6], [32.9, -97],     // US East/Central
      [34, -118], [47.4, -122.3], [39.8, -104.9],                 // US West
      [45.5, -73.6], [19.4, -99.1], [-23.4, -46.5], [4.7, -74],   // Canada/LatAm
      [28.6, 77.2], [19.1, 72.9], [13, 77.6],                     // India
      [25.2, 55.3], [26.3, 50.6], [30, 31.4], [41, 29],           // Middle East
      [31.2, 121.5], [22.3, 113.9], [35.5, 139.8], [37.5, 126.8], // East Asia
      [1.35, 103.99], [13.7, 100.75], [-6.1, 106.7],              // SE Asia
      [-33.9, 151.2], [-37.7, 144.8],                             // Australia
      [-26.1, 28.2], [6.6, 3.3],                                  // Africa
    ],
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
  const results = await Promise.allSettled(
    r.probes.map(async ([lat, lon]) => {
      const res = await fetchWithTimeout(
        `https://api.adsb.lol/v2/lat/${lat.toFixed(2)}/lon/${lon.toFixed(2)}/dist/250`,
        { timeoutMs: 10000 },
      );
      if (!res.ok) throw new Error(`adsb.lol HTTP ${res.status}`);
      const data = await res.json();
      return (data.ac ?? []) as AdsbAircraft[];
    }),
  );
  const seen = new Map<string, AdsbAircraft>();
  for (const p of results) {
    if (p.status !== "fulfilled") continue;
    for (const ac of p.value) {
      if (ac.lat == null || ac.lon == null || ac.alt_baro === "ground") continue;
      seen.set(ac.hex, ac);
    }
  }
  if (seen.size === 0) throw new Error("adsb.lol returned no aircraft");
  return [...seen.values()].slice(0, 4000).map((ac): Item => {
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
