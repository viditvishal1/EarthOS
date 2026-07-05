/** Curated open-reference geospatial points for map layers (G03). */

export type StaticGeoCategory =
  | "nuclear"
  | "pipelines"
  | "cables"
  | "ports"
  | "chokepoints"
  | "volcanoes"
  | "spaceports"
  | "refineries";

export interface StaticGeoPoint {
  id: string;
  category: StaticGeoCategory;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  summary?: string;
}

export const STATIC_GEO_POINTS: StaticGeoPoint[] = [
  // Nuclear
  { id: "nu:gravelines", category: "nuclear", name: "Gravelines NPP", lat: 51.015, lon: 2.136, region: "FR" },
  { id: "nu:cattenom", category: "nuclear", name: "Cattenom NPP", lat: 49.416, lon: 6.218, region: "FR" },
  { id: "nu:beznau", category: "nuclear", name: "Beznau NPP", lat: 47.518, lon: 8.228, region: "CH" },
  { id: "nu:krsko", category: "nuclear", name: "Krško NPP", lat: 45.938, lon: 15.518, region: "SI" },
  { id: "nu:zaporizhzhia", category: "nuclear", name: "Zaporizhzhia NPP", lat: 47.512, lon: 34.585, region: "UA" },
  { id: "nu:rivne", category: "nuclear", name: "Rivne NPP", lat: 51.327, lon: 25.895, region: "UA" },
  { id: "nu:khmelnytskyi", category: "nuclear", name: "Khmelnytskyi NPP", lat: 50.302, lon: 26.647, region: "UA" },
  { id: "nu:bushehr", category: "nuclear", name: "Bushehr NPP", lat: 28.831, lon: 50.886, region: "IR" },
  { id: "nu:barakah", category: "nuclear", name: "Barakah NPP", lat: 23.969, lon: 52.231, region: "AE" },
  { id: "nu:kudankulam", category: "nuclear", name: "Kudankulam NPP", lat: 8.169, lon: 77.712, region: "IN" },
  { id: "nu:taean", category: "nuclear", name: "Hanul NPP", lat: 37.093, lon: 129.384, region: "KR" },
  { id: "nu:pickering", category: "nuclear", name: "Pickering NPP", lat: 43.812, lon: -79.072, region: "CA" },
  { id: "nu:diablo", category: "nuclear", name: "Diablo Canyon", lat: 35.212, lon: -120.854, region: "US" },
  { id: "nu:vogtle", category: "nuclear", name: "Vogtle NPP", lat: 33.143, lon: -81.763, region: "US" },
  { id: "nu:fukushima-daiichi", category: "nuclear", name: "Fukushima Daiichi", lat: 37.421, lon: 141.033, region: "JP" },
  // Pipelines (terminals / hubs)
  { id: "pl:baku", category: "pipelines", name: "Baku oil hub", lat: 40.377, lon: 49.892, region: "AZ" },
  { id: "pl:ceyhan", category: "pipelines", name: "Ceyhan terminal", lat: 36.856, lon: 35.913, region: "TR" },
  { id: "pl:novorossiysk", category: "pipelines", name: "Novorossiysk port", lat: 44.723, lon: 37.769, region: "RU" },
  { id: "pl:rotterdam", category: "pipelines", name: "Rotterdam energy hub", lat: 51.905, lon: 4.466, region: "NL" },
  { id: "pl:houston", category: "pipelines", name: "Houston petrochemical hub", lat: 29.760, lon: -95.370, region: "US" },
  { id: "pl:basra", category: "pipelines", name: "Basra oil hub", lat: 30.508, lon: 47.784, region: "IQ" },
  { id: "pl:druzhba", category: "pipelines", name: "Druzhba junction (Brody)", lat: 50.087, lon: 25.147, region: "UA" },
  { id: "pl:tabriz", category: "pipelines", name: "Tabriz gas hub", lat: 38.080, lon: 46.292, region: "IR" },
  // Submarine cables (landing stations)
  { id: "cb:mumbai", category: "cables", name: "Mumbai cable landing", lat: 19.076, lon: 72.878, region: "IN" },
  { id: "cb:singapore", category: "cables", name: "Singapore cable hub", lat: 1.290, lon: 103.852, region: "SG" },
  { id: "cb:alexandria", category: "cables", name: "Alexandria landing", lat: 31.200, lon: 29.919, region: "EG" },
  { id: "cb:marseille", category: "cables", name: "Marseille landing", lat: 43.296, lon: 5.370, region: "FR" },
  { id: "cb:bude", category: "cables", name: "Bude UK landing", lat: 50.829, lon: -4.544, region: "GB" },
  { id: "cb:virginia_beach", category: "cables", name: "Virginia Beach landing", lat: 36.853, lon: -75.978, region: "US" },
  { id: "cb:fortaleza", category: "cables", name: "Fortaleza landing", lat: -3.732, lon: -38.527, region: "BR" },
  { id: "cb:perth", category: "cables", name: "Perth cable landing", lat: -31.951, lon: 115.861, region: "AU" },
  { id: "cb:tokyo", category: "cables", name: "Tokyo Bay landing", lat: 35.454, lon: 139.775, region: "JP" },
  { id: "cb:lagos", category: "cables", name: "Lagos cable landing", lat: 6.455, lon: 3.394, region: "NG" },
  // Ports
  { id: "pt:shanghai", category: "ports", name: "Port of Shanghai", lat: 31.230, lon: 121.474, region: "CN" },
  { id: "pt:singapore", category: "ports", name: "Port of Singapore", lat: 1.264, lon: 103.840, region: "SG" },
  { id: "pt:rotterdam", category: "ports", name: "Port of Rotterdam", lat: 51.949, lon: 4.142, region: "NL" },
  { id: "pt:los_angeles", category: "ports", name: "Port of Los Angeles", lat: 33.740, lon: -118.272, region: "US" },
  { id: "pt:houston", category: "ports", name: "Port of Houston", lat: 29.735, lon: -95.269, region: "US" },
  { id: "pt:antwerp", category: "ports", name: "Port of Antwerp", lat: 51.263, lon: 4.402, region: "BE" },
  { id: "pt:busan", category: "ports", name: "Port of Busan", lat: 35.102, lon: 129.040, region: "KR" },
  { id: "pt:dubai", category: "ports", name: "Jebel Ali", lat: 25.011, lon: 55.061, region: "AE" },
  { id: "pt:piraeus", category: "ports", name: "Port of Piraeus", lat: 37.943, lon: 23.647, region: "GR" },
  { id: "pt:colombo", category: "ports", name: "Port of Colombo", lat: 6.949, lon: 79.844, region: "LK" },
  { id: "pt:hamburg", category: "ports", name: "Port of Hamburg", lat: 53.546, lon: 9.966, region: "DE" },
  { id: "pt:chittagong", category: "ports", name: "Port of Chittagong", lat: 22.338, lon: 91.832, region: "BD" },
  // Chokepoints
  { id: "ch:suez", category: "chokepoints", name: "Suez Canal", lat: 30.585, lon: 32.349, region: "EG" },
  { id: "ch:hormuz", category: "chokepoints", name: "Strait of Hormuz", lat: 26.566, lon: 56.250, region: "OM" },
  { id: "ch:malacca", category: "chokepoints", name: "Strait of Malacca", lat: 2.500, lon: 101.500, region: "MY" },
  { id: "ch:bab", category: "chokepoints", name: "Bab el-Mandeb", lat: 12.583, lon: 43.333, region: "YE" },
  { id: "ch:panama", category: "chokepoints", name: "Panama Canal", lat: 9.080, lon: -79.680, region: "PA" },
  { id: "ch:gibraltar", category: "chokepoints", name: "Strait of Gibraltar", lat: 35.950, lon: -5.500, region: "ES" },
  { id: "ch:bosporus", category: "chokepoints", name: "Bosporus", lat: 41.120, lon: 29.050, region: "TR" },
  { id: "ch:taiwan", category: "chokepoints", name: "Taiwan Strait", lat: 24.500, lon: 119.500, region: "TW" },
  // Volcanoes
  { id: "vo:etna", category: "volcanoes", name: "Mount Etna", lat: 37.751, lon: 14.993, region: "IT" },
  { id: "vo:vesuvius", category: "volcanoes", name: "Mount Vesuvius", lat: 40.821, lon: 14.426, region: "IT" },
  { id: "vo:krakatoa", category: "volcanoes", name: "Krakatoa", lat: -6.102, lon: 105.423, region: "ID" },
  { id: "vo:merapi", category: "volcanoes", name: "Mount Merapi", lat: -7.541, lon: 110.446, region: "ID" },
  { id: "vo:fuji", category: "volcanoes", name: "Mount Fuji", lat: 35.361, lon: 138.728, region: "JP" },
  { id: "vo:kilauea", category: "volcanoes", name: "Kīlauea", lat: 19.421, lon: -155.287, region: "US" },
  { id: "vo:popocatepetl", category: "volcanoes", name: "Popocatépetl", lat: 19.023, lon: -98.622, region: "MX" },
  { id: "vo:nyiragongo", category: "volcanoes", name: "Nyiragongo", lat: -1.520, lon: 29.250, region: "CD" },
  { id: "vo:reykjanes", category: "volcanoes", name: "Reykjanes Peninsula", lat: 63.880, lon: -22.450, region: "IS" },
  // Spaceports
  { id: "sp:canaveral", category: "spaceports", name: "Cape Canaveral", lat: 28.392, lon: -80.608, region: "US" },
  { id: "sp:vandenberg", category: "spaceports", name: "Vandenberg SFB", lat: 34.742, lon: -120.572, region: "US" },
  { id: "sp:baikonur", category: "spaceports", name: "Baikonur Cosmodrome", lat: 45.965, lon: 63.305, region: "KZ" },
  { id: "sp:kourou", category: "spaceports", name: "Guiana Space Centre", lat: 5.239, lon: -52.768, region: "GF" },
  { id: "sp:tanegashima", category: "spaceports", name: "Tanegashima Space Center", lat: 30.400, lon: 131.000, region: "JP" },
  { id: "sp:sriharikota", category: "spaceports", name: "Satish Dhawan Space Centre", lat: 13.720, lon: 80.230, region: "IN" },
  { id: "sp:starbase", category: "spaceports", name: "Starbase Boca Chica", lat: 25.997, lon: -97.157, region: "US" },
  // Refineries
  { id: "rf:jamnagar", category: "refineries", name: "Jamnagar Refinery", lat: 22.470, lon: 69.890, region: "IN" },
  { id: "rf:port_arthur", category: "refineries", name: "Port Arthur Refinery", lat: 29.885, lon: -93.940, region: "US" },
  { id: "rf:ras_tanura", category: "refineries", name: "Ras Tanura", lat: 26.640, lon: 50.158, region: "SA" },
  { id: "rf:yeosu", category: "refineries", name: "Yeosu Refinery", lat: 34.760, lon: 127.662, region: "KR" },
  { id: "rf:rotterdam", category: "refineries", name: "Rotterdam refining cluster", lat: 51.886, lon: 4.330, region: "NL" },
  { id: "rf:baytown", category: "refineries", name: "Baytown Refinery", lat: 29.736, lon: -94.977, region: "US" },
  { id: "rf:yaroslavl", category: "refineries", name: "Yaroslavl Refinery", lat: 57.626, lon: 39.884, region: "RU" },
];

/** Major hub airport coordinates for NOTAM geocoding. */
export const HUB_AIRPORT_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  KJFK: { lat: 40.641, lon: -73.778, name: "JFK" },
  KLAX: { lat: 33.942, lon: -118.408, name: "LAX" },
  KORD: { lat: 41.974, lon: -87.907, name: "O'Hare" },
  KATL: { lat: 33.640, lon: -84.428, name: "Atlanta" },
  KDEN: { lat: 39.856, lon: -104.673, name: "Denver" },
  KSFO: { lat: 37.621, lon: -122.379, name: "SFO" },
  KDFW: { lat: 32.899, lon: -97.040, name: "DFW" },
  KMIA: { lat: 25.795, lon: -80.290, name: "Miami" },
  KSEA: { lat: 47.450, lon: -122.309, name: "Seattle" },
  KBOS: { lat: 42.365, lon: -71.010, name: "Boston" },
  EGLL: { lat: 51.470, lon: -0.454, name: "Heathrow" },
  LFPG: { lat: 49.010, lon: 2.548, name: "Charles de Gaulle" },
  EDDF: { lat: 50.037, lon: 8.562, name: "Frankfurt" },
  EHAM: { lat: 52.310, lon: 4.768, name: "Schiphol" },
  LEMD: { lat: 40.472, lon: -3.561, name: "Madrid" },
  LIRF: { lat: 41.800, lon: 12.238, name: "Rome Fiumicino" },
  OMDB: { lat: 25.253, lon: 55.365, name: "Dubai" },
  VHHH: { lat: 22.308, lon: 113.918, name: "Hong Kong" },
  WSSS: { lat: 1.364, lon: 103.991, name: "Changi" },
  RJTT: { lat: 35.549, lon: 139.780, name: "Haneda" },
  VIDP: { lat: 28.556, lon: 77.100, name: "Delhi" },
  VABB: { lat: 19.089, lon: 72.868, name: "Mumbai" },
  YSSY: { lat: -33.946, lon: 151.177, name: "Sydney" },
  CYYZ: { lat: 43.678, lon: -79.629, name: "Toronto Pearson" },
};

/** Platform HQ approximations for outage map layer. */
export const PLATFORM_HQ: Record<string, { lat: number; lon: number }> = {
  GitHub: { lat: 37.774, lon: -122.396 },
  Cloudflare: { lat: 37.785, lon: -122.396 },
  Vercel: { lat: 37.774, lon: -122.419 },
  OpenAI: { lat: 37.774, lon: -122.392 },
  Discord: { lat: 37.774, lon: -122.396 },
  Reddit: { lat: 37.774, lon: -122.396 },
  Dropbox: { lat: 37.774, lon: -122.396 },
  Twilio: { lat: 37.774, lon: -122.396 },
};

export function pointsByCategory(category: StaticGeoCategory): StaticGeoPoint[] {
  return STATIC_GEO_POINTS.filter((p) => p.category === category);
}
