/** Shared soft-TTL and retention config for the live-data layer. */

export const LIVE_HARD_TTL_SECONDS = 86_400;

export const LIVE_SOFT_TTL = {
  flights: 180,
  ships: 180,
  iss: 120,
  webcams: 86_400,
  cctv: 600,
} as const;

export const MODULE_SOFT_TTL: Record<string, number> = {
  markets: 120,
  aviation: 90,
  maritime: 90,
  news: 300,
  earth: 180,
  conflict: 600,
  cyber: 300,
  space: 300,
  macro: 3600,
  startup: 600,
  government: 600,
  infrastructure: 600,
};

export const FLIGHT_SEED_REGIONS = [
  "global", "europe", "usa", "india", "china", "mideast",
] as const;

export const BOOTSTRAP_FLIGHT_REGIONS = ["global", "europe", "usa", "india"] as const;

export const BOOTSTRAP_MODULES = ["earth", "news", "conflict", "cyber", "markets"] as const;

export const SEED_MODULES = [
  "earth", "news", "conflict", "cyber", "markets", "space",
] as const;

export const SEED_META_DOMAINS = [
  "flights:global",
  "ships:global",
  "webcams:all",
  "cctv:all",
  "iss:position",
  "module:markets",
  "module:earth",
] as const;

export const LIVE_SEED_LOCK_KEY = "lock:live-seed";
export const LIVE_SEED_LOCK_TTL_SECONDS = 240;
