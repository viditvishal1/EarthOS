/** Simplified country reference for MVP — bbox point-in-polygon (not full Natural Earth). */

export interface CountryRef {
  iso2: string;
  name: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  region: string;
}

export const COUNTRIES: CountryRef[] = [
  { iso2: "US", name: "United States", bbox: [-125, 24, -66, 50], region: "North America" },
  { iso2: "CA", name: "Canada", bbox: [-141, 41, -52, 70], region: "North America" },
  { iso2: "MX", name: "Mexico", bbox: [-118, 14, -86, 33], region: "North America" },
  { iso2: "GB", name: "United Kingdom", bbox: [-8, 49, 2, 61], region: "Europe" },
  { iso2: "FR", name: "France", bbox: [-5, 41, 10, 51], region: "Europe" },
  { iso2: "DE", name: "Germany", bbox: [5, 47, 15, 55], region: "Europe" },
  { iso2: "UA", name: "Ukraine", bbox: [22, 44, 40, 53], region: "Europe" },
  { iso2: "RU", name: "Russia", bbox: [19, 41, 180, 82], region: "Europe/Asia" },
  { iso2: "TR", name: "Turkey", bbox: [26, 36, 45, 42], region: "Middle East" },
  { iso2: "IL", name: "Israel", bbox: [34, 29, 36, 34], region: "Middle East" },
  { iso2: "IR", name: "Iran", bbox: [44, 25, 64, 40], region: "Middle East" },
  { iso2: "SA", name: "Saudi Arabia", bbox: [34, 16, 56, 33], region: "Middle East" },
  { iso2: "IN", name: "India", bbox: [68, 6, 97, 36], region: "South Asia" },
  { iso2: "PK", name: "Pakistan", bbox: [60, 23, 78, 37], region: "South Asia" },
  { iso2: "CN", name: "China", bbox: [73, 18, 135, 54], region: "East Asia" },
  { iso2: "JP", name: "Japan", bbox: [129, 30, 146, 46], region: "East Asia" },
  { iso2: "KR", name: "South Korea", bbox: [124, 33, 132, 39], region: "East Asia" },
  { iso2: "TW", name: "Taiwan", bbox: [119, 21, 122, 26], region: "East Asia" },
  { iso2: "AU", name: "Australia", bbox: [112, -44, 154, -10], region: "Oceania" },
  { iso2: "BR", name: "Brazil", bbox: [-74, -34, -34, 6], region: "South America" },
  { iso2: "NG", name: "Nigeria", bbox: [3, 4, 15, 14], region: "Africa" },
  { iso2: "ZA", name: "South Africa", bbox: [16, -35, 33, -22], region: "Africa" },
  { iso2: "EG", name: "Egypt", bbox: [24, 22, 37, 32], region: "Africa" },
  { iso2: "ET", name: "Ethiopia", bbox: [33, 3, 48, 15], region: "Africa" },
  { iso2: "SD", name: "Sudan", bbox: [22, 8, 39, 23], region: "Africa" },
  { iso2: "SY", name: "Syria", bbox: [35, 32, 42, 37], region: "Middle East" },
  { iso2: "YE", name: "Yemen", bbox: [42, 12, 54, 19], region: "Middle East" },
  { iso2: "MM", name: "Myanmar", bbox: [92, 9, 101, 28], region: "Southeast Asia" },
  { iso2: "AF", name: "Afghanistan", bbox: [60, 29, 75, 39], region: "South Asia" },
  { iso2: "IQ", name: "Iraq", bbox: [38, 29, 49, 37], region: "Middle East" },
  { iso2: "LB", name: "Lebanon", bbox: [35, 33, 36, 35], region: "Middle East" },
];

const byIso = new Map(COUNTRIES.map((c) => [c.iso2.toUpperCase(), c]));

export function getCountry(iso2: string): CountryRef | undefined {
  return byIso.get(iso2.toUpperCase());
}

export function listCountries(): CountryRef[] {
  return [...COUNTRIES];
}

export interface CountryLookupResult {
  iso2: string;
  name: string;
  confidence: "high" | "border_ambiguous" | "unknown";
}

/** Point-in-bbox country resolution — MVP approximation; border cells may match multiple. */
export function countryAtPoint(lat: number, lon: number): CountryLookupResult {
  const matches = COUNTRIES.filter(
    (c) => lon >= c.bbox[0] && lon <= c.bbox[2] && lat >= c.bbox[1] && lat <= c.bbox[3],
  );
  if (matches.length === 0) return { iso2: "", name: "Unknown", confidence: "unknown" };
  if (matches.length > 1) {
    const best = matches.sort((a, b) => area(a) - area(b))[0];
    return { iso2: best.iso2, name: best.name, confidence: "border_ambiguous" };
  }
  return { iso2: matches[0].iso2, name: matches[0].name, confidence: "high" };
}

function area(c: CountryRef): number {
  return (c.bbox[2] - c.bbox[0]) * (c.bbox[3] - c.bbox[1]);
}

export function itemsInCountry<T extends { lat?: number; lon?: number; region?: string }>(
  items: T[],
  iso2: string,
): T[] {
  const country = getCountry(iso2);
  if (!country) return [];
  const [w, s, e, n] = country.bbox;
  const iso = iso2.toUpperCase();
  const nameLower = country.name.toLowerCase();
  return items.filter((i) => {
    if (typeof i.lat === "number" && typeof i.lon === "number") {
      return i.lon >= w && i.lon <= e && i.lat >= s && i.lat <= n;
    }
    const r = (i.region ?? "").toLowerCase();
    return r.includes(nameLower) || r.includes(iso.toLowerCase());
  });
}
