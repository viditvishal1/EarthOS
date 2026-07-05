// Seed configuration derived from existing hardcoded connector values.
// Applied via /api/admin/seed or SQL — not loaded at runtime unless DB empty.
// Full global universe (all NSE/NYSE tickers) requires a paid market-data provider quota;
// seeds below cover major indices + liquid US/IN/UK/JP names via Yahoo Finance (free, delayed).

import type { DataSourceConfig, GeoLocationConfig, MarketInstrumentConfig } from "@/lib/platform/types";

export const SEED_DATA_SOURCES: Omit<DataSourceConfig, "config_json">[] = [
  { id: "news_bbc_world", name: "BBC World RSS", source_type: "news", provider: "BBC", enabled: true, priority: 60, polling_interval_seconds: 300, retention_hours: 48, reliability_score: 0.9, requires_api_key: false, geographic_scope: "global" },
  { id: "opensky_states", name: "OpenSky Network", source_type: "aviation", provider: "OpenSky", enabled: true, priority: 70, polling_interval_seconds: 120, retention_hours: 12, reliability_score: 0.75, requires_api_key: false, geographic_scope: "regional", daily_request_budget: 500 },
  { id: "aishub_vessels", name: "AISHub Vessels", source_type: "maritime", provider: "AISHub", enabled: true, priority: 50, polling_interval_seconds: 300, retention_hours: 24, reliability_score: 0.7, requires_api_key: true, api_key_env_var: "AISHUB_API_KEY", geographic_scope: "regional" },
  { id: "stooq_eod", name: "Stooq EOD", source_type: "markets", provider: "Stooq", enabled: true, priority: 85, polling_interval_seconds: 3600, retention_hours: 168, reliability_score: 0.8, requires_api_key: false, geographic_scope: "global" },
  { id: "yahoo_quotes", name: "Yahoo Finance", source_type: "markets", provider: "Yahoo", enabled: false, priority: 10, polling_interval_seconds: 300, retention_hours: 24, reliability_score: 0.5, requires_api_key: false, geographic_scope: "global" },
  { id: "coingecko_markets", name: "CoinGecko Markets", source_type: "markets", provider: "CoinGecko", enabled: true, priority: 75, polling_interval_seconds: 300, retention_hours: 24, reliability_score: 0.85, requires_api_key: false, geographic_scope: "global" },
  { id: "usgs_earthquakes", name: "USGS Earthquakes", source_type: "earth", provider: "USGS", enabled: true, priority: 90, polling_interval_seconds: 300, retention_hours: 168, reliability_score: 0.95, requires_api_key: false, geographic_scope: "global" },
  { id: "nvd_cves", name: "NVD CVEs", source_type: "cyber", provider: "NIST NVD", enabled: true, priority: 70, polling_interval_seconds: 600, retention_hours: 168, reliability_score: 0.9, requires_api_key: false, geographic_scope: "global" },
  { id: "producthunt_today", name: "Product Hunt", source_type: "startup", provider: "Product Hunt", enabled: true, priority: 40, polling_interval_seconds: 3600, retention_hours: 48, reliability_score: 0.8, requires_api_key: true, api_key_env_var: "PRODUCTHUNT_API_TOKEN", geographic_scope: "global" },
];

export const SEED_CITIES: GeoLocationConfig[] = [
  { id: "city_delhi", name: "New Delhi", location_type: "city", lat: 28.61, lon: 77.21, country_code: "IN", identifiers: {}, enabled: true },
  { id: "city_mumbai", name: "Mumbai", location_type: "city", lat: 19.08, lon: 72.88, country_code: "IN", identifiers: {}, enabled: true },
  { id: "city_bengaluru", name: "Bengaluru", location_type: "city", lat: 12.97, lon: 77.59, country_code: "IN", identifiers: {}, enabled: true },
  { id: "city_london", name: "London", location_type: "city", lat: 51.51, lon: -0.13, country_code: "GB", identifiers: {}, enabled: true },
  { id: "city_nyc", name: "New York", location_type: "city", lat: 40.71, lon: -74.01, country_code: "US", identifiers: {}, enabled: true },
  { id: "city_sf", name: "San Francisco", location_type: "city", lat: 37.77, lon: -122.42, country_code: "US", identifiers: {}, enabled: true },
  { id: "city_tokyo", name: "Tokyo", location_type: "city", lat: 35.68, lon: 139.69, country_code: "JP", identifiers: {}, enabled: true },
  { id: "city_singapore", name: "Singapore", location_type: "city", lat: 1.35, lon: 103.82, country_code: "SG", identifiers: {}, enabled: true },
  { id: "city_dubai", name: "Dubai", location_type: "city", lat: 25.2, lon: 55.27, country_code: "AE", identifiers: {}, enabled: true },
  { id: "city_beijing", name: "Beijing", location_type: "city", lat: 39.9, lon: 116.4, country_code: "CN", identifiers: {}, enabled: true },
  { id: "city_shanghai", name: "Shanghai", location_type: "city", lat: 31.23, lon: 121.47, country_code: "CN", identifiers: {}, enabled: true },
  { id: "city_lagos", name: "Lagos", location_type: "city", lat: 6.52, lon: 3.38, country_code: "NG", identifiers: {}, enabled: true },
];

export const SEED_MARKET_INSTRUMENTS: MarketInstrumentConfig[] = [
  { id: "idx_gspc", symbol: "^GSPC", name: "S&P 500", instrument_type: "index", exchange: "SNP", provider: "stooq", enabled: true },
  { id: "idx_dji", symbol: "^DJI", name: "Dow Jones", instrument_type: "index", provider: "stooq", enabled: true },
  { id: "idx_ixic", symbol: "^IXIC", name: "NASDAQ Composite", instrument_type: "index", provider: "stooq", enabled: true },
  { id: "idx_ftse", symbol: "^FTSE", name: "FTSE 100", instrument_type: "index", provider: "stooq", enabled: true },
  { id: "idx_n225", symbol: "^N225", name: "Nikkei 225", instrument_type: "index", provider: "stooq", enabled: true },
  { id: "eq_aapl", symbol: "AAPL", name: "Apple Inc.", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_msft", symbol: "MSFT", name: "Microsoft", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_nvda", symbol: "NVDA", name: "NVIDIA", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_googl", symbol: "GOOGL", name: "Alphabet", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_amzn", symbol: "AMZN", name: "Amazon", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_tsla", symbol: "TSLA", name: "Tesla", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_meta", symbol: "META", name: "Meta Platforms", instrument_type: "equity", exchange: "NASDAQ", provider: "yahoo", enabled: true },
  { id: "eq_jpm", symbol: "JPM", name: "JPMorgan Chase", instrument_type: "equity", exchange: "NYSE", provider: "yahoo", enabled: true },
  { id: "eq_v", symbol: "V", name: "Visa", instrument_type: "equity", exchange: "NYSE", provider: "yahoo", enabled: true },
  { id: "eq_jnj", symbol: "JNJ", name: "Johnson & Johnson", instrument_type: "equity", exchange: "NYSE", provider: "yahoo", enabled: true },
  { id: "eq_wmt", symbol: "WMT", name: "Walmart", instrument_type: "equity", exchange: "NYSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_reliance", symbol: "RELIANCE.NS", name: "Reliance Industries", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_tcs", symbol: "TCS.NS", name: "Tata Consultancy Services", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_infy", symbol: "INFY.NS", name: "Infosys", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_hdfcbank", symbol: "HDFCBANK.NS", name: "HDFC Bank", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_icicibank", symbol: "ICICIBANK.NS", name: "ICICI Bank", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_sbinn", symbol: "SBIN.NS", name: "State Bank of India", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_bajfinance", symbol: "BAJFINANCE.NS", name: "Bajaj Finance", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_nse_bhartiartl", symbol: "BHARTIARTL.NS", name: "Bharti Airtel", instrument_type: "equity", exchange: "NSE", provider: "yahoo", enabled: true },
  { id: "eq_lse_hsba", symbol: "HSBA.L", name: "HSBC Holdings", instrument_type: "equity", exchange: "LSE", provider: "yahoo", enabled: true },
  { id: "eq_tse_7203", symbol: "7203.T", name: "Toyota Motor", instrument_type: "equity", exchange: "TSE", provider: "yahoo", enabled: true },
];

export const SEED_NEWS_FEEDS = [
  { id: "news_bbc_world", source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tags: ["world"], region: "Global" },
  { id: "news_the_guardian", source: "The Guardian", url: "https://www.theguardian.com/world/rss", tags: ["world"], region: "Global" },
  { id: "news_al_jazeera", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", tags: ["world"], region: "Global" },
  { id: "news_npr", source: "NPR", url: "https://feeds.npr.org/1001/rss.xml", tags: ["world"], region: "US" },
  { id: "news_techcrunch", source: "TechCrunch", url: "https://techcrunch.com/feed/", tags: ["technology"], region: "Global" },
  { id: "news_ars_technica", source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tags: ["technology"], region: "Global" },
  { id: "news_the_verge", source: "The Verge", url: "https://www.theverge.com/rss/index.xml", tags: ["technology"], region: "Global" },
  { id: "news_the_hindu", source: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", tags: ["world"], region: "India" },
] as const;

export const SEED_NEWS_COUNTRIES = [
  { code: "US", name: "United States", hl: "en-US", gl: "US", ceid: "US:en" },
  { code: "IN", name: "India", hl: "en-IN", gl: "IN", ceid: "IN:en" },
  { code: "GB", name: "United Kingdom", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  { code: "AU", name: "Australia", hl: "en-AU", gl: "AU", ceid: "AU:en" },
  { code: "CA", name: "Canada", hl: "en-CA", gl: "CA", ceid: "CA:en" },
  { code: "SG", name: "Singapore", hl: "en-SG", gl: "SG", ceid: "SG:en" },
  { code: "AE", name: "UAE", hl: "en-AE", gl: "AE", ceid: "AE:en" },
] as const;

export const SEED_NEWS_CATEGORIES = ["WORLD", "BUSINESS", "TECHNOLOGY", "SCIENCE", "SPORTS", "HEALTH", "ENTERTAINMENT"] as const;

export const SEED_AVIATION_REGIONS: GeoLocationConfig[] = [
  { id: "region_global", name: "Global", location_type: "region", bbox: [-180, -60, 180, 75], identifiers: {}, enabled: true },
  { id: "region_europe", name: "Europe", location_type: "region", bbox: [-12, 35, 32, 62], identifiers: {}, enabled: true },
  { id: "region_usa", name: "USA", location_type: "region", bbox: [-126, 24, -66, 50], identifiers: {}, enabled: true },
  { id: "region_india", name: "India", location_type: "region", bbox: [68, 6, 97, 36], identifiers: {}, enabled: true },
  { id: "region_china", name: "China", location_type: "region", bbox: [73, 18, 135, 54], identifiers: {}, enabled: true },
  { id: "region_africa", name: "Africa", location_type: "region", bbox: [-18, -35, 52, 38], identifiers: {}, enabled: true },
];
