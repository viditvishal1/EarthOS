import { fetchWithTimeout } from "@/lib/connectors/framework";

export interface AirportRecord {
  icao: string;
  iata?: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  timezone?: string;
}

const g = globalThis as unknown as { __argusAirports?: Map<string, AirportRecord> };

async function loadAirports(): Promise<Map<string, AirportRecord>> {
  if (g.__argusAirports?.size) return g.__argusAirports;

  const map = new Map<string, AirportRecord>();
  const url = "https://davidmegginson.github.io/ourairports-data/airports.csv";
  const res = await fetchWithTimeout(url, { timeoutMs: 30_000 });
  if (!res.ok) throw new Error(`ourairports_http_${res.status}`);

  const text = await res.text();
  const lines = text.split("\n");
  const headers = lines[0]?.split(",").map((h) => h.replace(/"/g, "")) ?? [];
  const idx = (name: string) => headers.indexOf(name);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const ident = cols[idx("ident")];
    const type = cols[idx("type")];
    if (!ident || (type !== "large_airport" && type !== "medium_airport")) continue;
    const lat = Number(cols[idx("latitude_deg")]);
    const lng = Number(cols[idx("longitude_deg")]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    map.set(ident.toUpperCase(), {
      icao: ident.toUpperCase(),
      iata: cols[idx("iata_code")] || undefined,
      name: cols[idx("name")] ?? ident,
      lat,
      lng,
      country: cols[idx("iso_country")] ?? "",
      timezone: cols[idx("timezone")] || undefined,
    });
  }

  g.__argusAirports = map;
  return map;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

export async function lookupAirport(icao: string): Promise<AirportRecord | null> {
  const map = await loadAirports();
  return map.get(icao.toUpperCase()) ?? null;
}

export async function airportsInBbox(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 100,
): Promise<AirportRecord[]> {
  const map = await loadAirports();
  const out: AirportRecord[] = [];
  for (const a of map.values()) {
    if (a.lng >= west && a.lng <= east && a.lat >= south && a.lat <= north) {
      out.push(a);
      if (out.length >= limit) break;
    }
  }
  return out;
}
