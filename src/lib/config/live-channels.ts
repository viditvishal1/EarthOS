// Live Channels registry — officially published public live streams only:
// broadcaster YouTube live channels and public city webcams that the operator
// publishes for open viewing. Never unsecured/private cameras.
//
// YouTube live video IDs rotate when a stream restarts; each entry keeps the
// channel URL as a fallback link. IDs sourced/cross-checked from the
// worldmonitor project's verified list (Feb 2026) — update when stale.

export type LiveCategory = "news" | "finance" | "webcam" | "space";
export type LiveRegion = "global" | "americas" | "europe" | "middle-east" | "asia" | "india" | "space";

export interface LiveChannel {
  id: string;
  name: string;
  place?: string; // city / label for webcams
  category: LiveCategory;
  region: LiveRegion;
  videoId: string; // YouTube live video id (rotates; fallback = channelUrl)
  channelUrl: string;
  provider: string; // who operates/publishes the stream
}

export const LIVE_CHANNELS: LiveChannel[] = [
  // --- Live news TV (official broadcaster channels) ---
  { id: "sky", name: "Sky News", category: "news", region: "europe", videoId: "uvviIF4725I", channelUrl: "https://www.youtube.com/@SkyNews/live", provider: "Sky News" },
  { id: "dw", name: "DW News", category: "news", region: "europe", videoId: "LuKwFajn37U", channelUrl: "https://www.youtube.com/@DWNews/live", provider: "Deutsche Welle" },
  { id: "euronews", name: "Euronews", category: "news", region: "europe", videoId: "pykpO5kQJ98", channelUrl: "https://www.youtube.com/@euronews/live", provider: "Euronews" },
  { id: "france24", name: "France 24 English", category: "news", region: "europe", videoId: "Ap-UM1O9RBU", channelUrl: "https://www.youtube.com/@France24_en/live", provider: "France 24" },
  { id: "aljazeera", name: "Al Jazeera English", category: "news", region: "middle-east", videoId: "gCNeDWCI0vo", channelUrl: "https://www.youtube.com/@AlJazeeraEnglish/live", provider: "Al Jazeera" },
  { id: "trt", name: "TRT World", category: "news", region: "middle-east", videoId: "3XHebGJG0bc", channelUrl: "https://www.youtube.com/@trtworld/live", provider: "TRT" },
  { id: "abc-news", name: "ABC News", category: "news", region: "americas", videoId: "w_Ma8oQLmSM", channelUrl: "https://www.youtube.com/@ABCNews/live", provider: "ABC News" },
  { id: "cbs-news", name: "CBS News", category: "news", region: "americas", videoId: "R9L8sDK8iEc", channelUrl: "https://www.youtube.com/@CBSNews/live", provider: "CBS News" },
  { id: "nbc-news", name: "NBC News", category: "news", region: "americas", videoId: "yMr0neQhu6c", channelUrl: "https://www.youtube.com/@NBCNews/live", provider: "NBC News" },
  { id: "cbc-news", name: "CBC News", category: "news", region: "americas", videoId: "jxP_h3V-Dv8", channelUrl: "https://www.youtube.com/@CBCNews/live", provider: "CBC" },
  { id: "wion", name: "WION", category: "news", region: "india", videoId: "gadjsB5BkK4", channelUrl: "https://www.youtube.com/@WION/live", provider: "WION" },
  { id: "ndtv", name: "NDTV 24x7", category: "news", region: "india", videoId: "qzZuBWMnS08", channelUrl: "https://www.youtube.com/@NDTV/live", provider: "NDTV" },
  { id: "indiatoday", name: "India Today", category: "news", region: "india", videoId: "8Z5EjAmZS1o", channelUrl: "https://www.youtube.com/@IndiaToday/live", provider: "India Today" },

  // --- Finance TV ---
  { id: "bloomberg", name: "Bloomberg TV", category: "finance", region: "global", videoId: "iEpJwprxDdk", channelUrl: "https://www.youtube.com/@markets/live", provider: "Bloomberg" },
  { id: "cnbc", name: "CNBC", category: "finance", region: "americas", videoId: "9NyxcX3rhQs", channelUrl: "https://www.youtube.com/@CNBC/live", provider: "CNBC" },
  { id: "yahoo-finance", name: "Yahoo Finance", category: "finance", region: "americas", videoId: "KQp-e_XQnDE", channelUrl: "https://www.youtube.com/@YahooFinance/live", provider: "Yahoo Finance" },

  // --- Public city webcams (operator-published) ---
  { id: "jerusalem", name: "Western Wall", place: "Jerusalem", category: "webcam", region: "middle-east", videoId: "e34xb-Fbl0U", channelUrl: "https://www.youtube.com/@TheWesternWall/live", provider: "The Western Wall Heritage Foundation" },
  { id: "mecca", name: "Makkah Live", place: "Mecca", category: "webcam", region: "middle-east", videoId: "kJwEsQTegxk", channelUrl: "https://www.youtube.com/@MakkahLive/live", provider: "Makkah Live" },
  { id: "kyiv", name: "Kyiv Skyline", place: "Kyiv", category: "webcam", region: "europe", videoId: "-Q7FuPINDjA", channelUrl: "https://www.youtube.com/@DWNews/live", provider: "DW" },
  { id: "london", name: "London — Abbey Road", place: "London", category: "webcam", region: "europe", videoId: "Lxqcg1qt0XU", channelUrl: "https://www.youtube.com/@EarthCam/live", provider: "EarthCam" },
  { id: "nyc", name: "New York — Times Square", place: "New York", category: "webcam", region: "americas", videoId: "4qyZLflp-sI", channelUrl: "https://www.youtube.com/@EarthCam/live", provider: "EarthCam" },
  { id: "miami", name: "Miami Beach", place: "Miami", category: "webcam", region: "americas", videoId: "5YCajRjvWCg", channelUrl: "https://www.youtube.com/@FloridaLiveCams/live", provider: "Florida Live Cams" },
  { id: "taipei", name: "Taipei City", place: "Taipei", category: "webcam", region: "asia", videoId: "z_fY1pj1VBw", channelUrl: "https://www.youtube.com/@JackyWuTaipei/live", provider: "Taipei webcam operator" },
  { id: "shanghai", name: "Shanghai Skyline", place: "Shanghai", category: "webcam", region: "asia", videoId: "76EwqI5XZIc", channelUrl: "https://www.youtube.com/@SkylineWebcams/live", provider: "SkylineWebcams" },
  { id: "tokyo", name: "Tokyo 4K", place: "Tokyo", category: "webcam", region: "asia", videoId: "_k-5U7IeK8g", channelUrl: "https://www.youtube.com/@TokyoLiveCam4K/live", provider: "Tokyo Live Cam" },
  { id: "seoul", name: "Seoul — UN Village", place: "Seoul", category: "webcam", region: "asia", videoId: "-JhoMGoAfFc", channelUrl: "https://www.youtube.com/@UNvillage_live/live", provider: "UN Village Live" },
  { id: "sydney", name: "Sydney Harbour", place: "Sydney", category: "webcam", region: "asia", videoId: "7pcL-0Wo77U", channelUrl: "https://www.youtube.com/@WebcamSydney/live", provider: "Webcam Sydney" },

  // --- Space ---
  { id: "iss", name: "ISS Earth View", category: "space", region: "space", videoId: "vytmBNhc9ig", channelUrl: "https://www.youtube.com/@NASA/live", provider: "NASA" },
  { id: "nasa-tv", name: "NASA TV", category: "space", region: "space", videoId: "zPH5KtjJFaQ", channelUrl: "https://www.youtube.com/@NASA/live", provider: "NASA" },
];

export const LIVE_CATEGORIES: { id: LiveCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "news", label: "News TV" },
  { id: "finance", label: "Finance TV" },
  { id: "webcam", label: "City webcams" },
  { id: "space", label: "Space" },
];
