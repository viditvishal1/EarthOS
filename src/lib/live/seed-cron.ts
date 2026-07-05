import { runConnector, fetchFlights } from "@/lib/connectors";
import { fetchIss } from "@/lib/connectors/space";
import { readLiveCached, seedLiveSafe } from "@/lib/live/store";
import { seedModuleLive } from "@/lib/live/module-cache";
import { writeSeedMeta } from "@/lib/live/seed-meta";
import { fetchAllWebcams } from "@/lib/live/webcams";
import { seedAllCctv } from "@/lib/live/cctv/seed";
import { seedObservationsBundle } from "@/lib/observations/service";
import { seedDefaultSatellites } from "@/lib/satellites/store";
import {
  FLIGHT_SEED_REGIONS,
  LIVE_SOFT_TTL,
  SEED_MODULES,
} from "@/lib/live/config";
import type { Item } from "@/lib/types";

export type DomainSeedStatus = "ok" | "preserved" | "error" | "skipped";

export interface DomainSeedResult {
  domain: string;
  status: DomainSeedStatus;
  count: number;
  source: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface SeedLiveDomainsResult {
  domains: DomainSeedResult[];
  durationMs: number;
  redisWriteFailures: number;
}

function sanitizeError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let code = "fetch_failed";
  if (lower.includes("timeout")) code = "timeout";
  else if (lower.includes("429") || lower.includes("rate")) code = "rate_limited";
  else if (lower.includes("401") || lower.includes("403")) code = "auth_failed";
  else if (lower.includes("key")) code = "missing_credentials";
  return { code, message: message.slice(0, 200) };
}

async function seedFlightsRegion(region: string): Promise<DomainSeedResult> {
  const domain = `flights:${region}`;
  const started = Date.now();
  const source = "OpenSky/adsb.lol/Wingbits";
  try {
    const items: Item[] = await fetchFlights(region, "full");
    if (items.length === 0) {
      const cached = await readLiveCached<Item[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source,
        fallback: [],
      });
      if (cached.data.length > 0) {
        return {
          domain,
          status: "preserved",
          count: cached.data.length,
          source: cached.source,
          durationMs: Date.now() - started,
          errorCode: "empty_fetch",
          errorMessage: "Upstream returned zero aircraft; kept last-known-good",
        };
      }
      return {
        domain,
        status: "error",
        count: 0,
        source,
        durationMs: Date.now() - started,
        errorCode: "empty_fetch",
        errorMessage: "No aircraft returned and no cached value to preserve",
      };
    }
    const write = await seedLiveSafe(domain, items, source);
    if (!write.ok) {
      const cached = await readLiveCached<Item[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source,
        fallback: [],
      });
      return {
        domain,
        status: cached.data.length > 0 ? "preserved" : "error",
        count: cached.data.length,
        source,
        durationMs: Date.now() - started,
        errorCode: "redis_write_failed",
        errorMessage: write.error ?? "Redis write failed",
      };
    }
    await writeSeedMeta(domain, items.length, source);
    return { domain, status: "ok", count: items.length, source, durationMs: Date.now() - started };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    const cached = await readLiveCached<Item[]>(domain, {
      ttlSeconds: LIVE_SOFT_TTL.flights,
      source,
      fallback: [],
    });
    return {
      domain,
      status: cached.data.length > 0 ? "preserved" : "error",
      count: cached.data.length,
      source: cached.source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function seedShips(): Promise<DomainSeedResult> {
  const domain = "ships:global";
  const started = Date.now();
  const source = "AISHub";
  try {
    if (!process.env.AISHUB_API_KEY) {
      const cached = await readLiveCached<Item[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.ships,
        source,
        fallback: [],
      });
      return {
        domain,
        status: cached.data.length > 0 ? "preserved" : "skipped",
        count: cached.data.length,
        source,
        durationMs: Date.now() - started,
        errorCode: "missing_credentials",
        errorMessage: "AISHUB_API_KEY not configured",
      };
    }
    const items = (await runConnector("aishub_vessels")).filter((i) => typeof i.lat === "number");
    if (items.length === 0) {
      const cached = await readLiveCached<Item[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.ships,
        source,
        fallback: [],
      });
      if (cached.data.length > 0) {
        return {
          domain,
          status: "preserved",
          count: cached.data.length,
          source: cached.source,
          durationMs: Date.now() - started,
          errorCode: "empty_fetch",
          errorMessage: "AISHub returned zero vessels; kept last-known-good",
        };
      }
      return {
        domain,
        status: "error",
        count: 0,
        source,
        durationMs: Date.now() - started,
        errorCode: "empty_fetch",
        errorMessage: "No vessels returned",
      };
    }
    const write = await seedLiveSafe(domain, items, source);
    if (!write.ok) {
      const cached = await readLiveCached<Item[]>(domain, {
        ttlSeconds: LIVE_SOFT_TTL.ships,
        source,
        fallback: [],
      });
      return {
        domain,
        status: cached.data.length > 0 ? "preserved" : "error",
        count: cached.data.length,
        source,
        durationMs: Date.now() - started,
        errorCode: "redis_write_failed",
        errorMessage: write.error ?? "Redis write failed",
      };
    }
    await writeSeedMeta(domain, items.length, source);
    return { domain, status: "ok", count: items.length, source, durationMs: Date.now() - started };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    const cached = await readLiveCached<Item[]>(domain, {
      ttlSeconds: LIVE_SOFT_TTL.ships,
      source,
      fallback: [],
    });
    return {
      domain,
      status: cached.data.length > 0 ? "preserved" : "error",
      count: cached.data.length,
      source: cached.source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function seedWebcams(): Promise<DomainSeedResult> {
  const domain = "webcams:all";
  const started = Date.now();
  const source = "Curated + Windy";
  try {
    const items = await fetchAllWebcams();
    const write = await seedLiveSafe(domain, items, source, { seedEmpty: items.length === 0 });
    if (!write.ok && !write.skipped) {
      return {
        domain,
        status: "error",
        count: 0,
        source,
        durationMs: Date.now() - started,
        errorCode: "redis_write_failed",
        errorMessage: write.error,
      };
    }
    if (items.length > 0) await writeSeedMeta(domain, items.length, source);
    return { domain, status: "ok", count: items.length, source, durationMs: Date.now() - started };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    return {
      domain,
      status: "error",
      count: 0,
      source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function seedIss(): Promise<DomainSeedResult> {
  const domain = "iss:position";
  const started = Date.now();
  const source = "wheretheiss.at";
  try {
    const pos = await fetchIss();
    if (typeof pos.lat !== "number") {
      throw new Error("invalid_iss_position");
    }
    const write = await seedLiveSafe(domain, pos, source);
    if (!write.ok) {
      return {
        domain,
        status: "error",
        count: 0,
        source,
        durationMs: Date.now() - started,
        errorCode: "redis_write_failed",
        errorMessage: write.error,
      };
    }
    await writeSeedMeta(domain, 1, source);
    return { domain, status: "ok", count: 1, source, durationMs: Date.now() - started };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    return {
      domain,
      status: "error",
      count: 0,
      source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

async function seedModuleDomain(mod: string): Promise<DomainSeedResult> {
  const domain = `module:${mod}`;
  const started = Date.now();
  const source = `connectors:${mod}`;
  try {
    const count = await seedModuleLive(mod);
    if (count < 0) {
      return {
        domain,
        status: "error",
        count: 0,
        source,
        durationMs: Date.now() - started,
        errorCode: "connector_failed",
        errorMessage: "Module connectors failed",
      };
    }
    return { domain, status: "ok", count, source, durationMs: Date.now() - started };
  } catch (err) {
    const { code, message } = sanitizeError(err);
    return {
      domain,
      status: "error",
      count: 0,
      source,
      durationMs: Date.now() - started,
      errorCode: code,
      errorMessage: message,
    };
  }
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push([...arr.slice(i, i + size)]);
  return out;
}

export async function seedLiveDomains(): Promise<SeedLiveDomainsResult> {
  const started = Date.now();
  const domains: DomainSeedResult[] = [];

  for (const batch of chunk(FLIGHT_SEED_REGIONS, 2)) {
    const results = await Promise.all(batch.map((r) => seedFlightsRegion(r)));
    domains.push(...results);
  }

  domains.push(await seedShips());
  domains.push(await seedWebcams());
  domains.push(...await seedAllCctv());

  const obsStarted = Date.now();
  try {
    const obsCount = await seedObservationsBundle();
    domains.push({
      domain: "observations:recent",
      status: obsCount > 0 ? "ok" : "skipped",
      count: obsCount,
      source: "news/conflict/earth",
      durationMs: Date.now() - obsStarted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    domains.push({
      domain: "observations:recent",
      status: "error",
      count: 0,
      source: "news/conflict/earth",
      durationMs: Date.now() - obsStarted,
      errorCode: "seed_failed",
      errorMessage: message.slice(0, 200),
    });
  }

  domains.push(await seedIss());

  const satStarted = Date.now();
  try {
    const sat = await seedDefaultSatellites();
    domains.push({
      domain: "satellites:tle:stations",
      status: sat.total > 0 ? "ok" : "skipped",
      count: sat.total,
      source: "CelesTrak/SGP4",
      durationMs: Date.now() - satStarted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    domains.push({
      domain: "satellites:tle:stations",
      status: "error",
      count: 0,
      source: "CelesTrak/SGP4",
      durationMs: Date.now() - satStarted,
      errorCode: "seed_failed",
      errorMessage: message.slice(0, 200),
    });
  }

  for (const batch of chunk(SEED_MODULES, 2)) {
    const results = await Promise.all(batch.map((m) => seedModuleDomain(m)));
    domains.push(...results);
  }

  const redisWriteFailures = domains.filter((d) => d.errorCode === "redis_write_failed").length;

  return {
    domains,
    durationMs: Date.now() - started,
    redisWriteFailures,
  };
}

/** Legacy shape for callers expecting flat counts. */
export function legacyCountsFromDomains(domains: DomainSeedResult[]): {
  flights: Record<string, number>;
  ships: number;
  webcams: number;
  cctv: number;
  iss: number;
  modules: Record<string, number>;
} {
  const flights: Record<string, number> = {};
  let ships = 0;
  let webcams = 0;
  let cctv = 0;
  let iss = 0;
  const modules: Record<string, number> = {};

  for (const d of domains) {
    if (d.domain.startsWith("flights:")) {
      flights[d.domain.replace("flights:", "")] = d.status === "error" ? -1 : d.count;
    } else if (d.domain === "ships:global") {
      ships = d.status === "error" ? -1 : d.count;
    } else if (d.domain === "webcams:all") {
      webcams = d.status === "error" ? -1 : d.count;
    } else if (d.domain === "cctv:all") {
      cctv = d.status === "error" ? -1 : d.count;
    } else if (d.domain === "iss:position") {
      iss = d.status === "error" ? -1 : d.count;
    } else if (d.domain.startsWith("module:")) {
      modules[d.domain.replace("module:", "")] = d.status === "error" ? -1 : d.count;
    }
  }

  return { flights, ships, webcams, cctv, iss, modules };
}

export type CronDomainStatus =
  | "success"
  | "partial"
  | "skipped"
  | "failed"
  | "preserved-last-known-good";

export interface CronDomainSummary {
  status: CronDomainStatus;
  count: number;
  durationMs: number;
  source: string;
  errorCode?: string;
  errorMessage?: string;
}

function mapInternalStatus(d: DomainSeedResult): CronDomainStatus {
  if (d.status === "ok") return "success";
  if (d.status === "preserved") return "preserved-last-known-good";
  if (d.status === "skipped") return "skipped";
  if (d.status === "error" && d.count > 0) return "partial";
  return "failed";
}

/** Actionable domain map for cron responses — grouped by logical domain key. */
export function formatCronDomainSummaries(domains: DomainSeedResult[]): Record<string, CronDomainSummary> {
  const out: Record<string, CronDomainSummary> = {};

  for (const d of domains) {
    let key: string;
    if (d.domain.startsWith("flights:")) {
      key = d.domain === "flights:global" ? "flights" : d.domain.replace("flights:", "flights_");
    } else if (d.domain === "ships:global") {
      key = "ships";
    } else if (d.domain === "webcams:all") {
      key = "webcams";
    } else if (d.domain === "cctv:all") {
      key = "cctv";
    } else if (d.domain === "iss:position") {
      key = "iss";
    } else if (d.domain.startsWith("module:")) {
      key = d.domain.replace("module:", "module_");
    } else {
      key = d.domain.replace(/[:]/g, "_");
    }

    const summary: CronDomainSummary = {
      status: mapInternalStatus(d),
      count: d.count,
      durationMs: d.durationMs,
      source: d.source,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
    };

    if (key === "ships" && d.errorCode === "missing_credentials") {
      summary.errorCode = "MISSING_AISHUB_API_KEY";
    }

    out[key] = summary;
  }

  return out;
}
