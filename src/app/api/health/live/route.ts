import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/cache/redis";
import { readLiveCached } from "@/lib/live/store";
import { readAllSeedMeta } from "@/lib/live/seed-meta";
import {
  LIVE_SOFT_TTL,
  SEED_META_DOMAINS,
} from "@/lib/live/config";
import type { Item } from "@/lib/types";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  await trackApiRequest("/api/health/live");

  const redis = await checkRedisHealth();
  const seedMeta = await readAllSeedMeta([...SEED_META_DOMAINS]);

  const domainReads = await Promise.all(
    SEED_META_DOMAINS.map(async (domain) => {
      if (domain.startsWith("module:")) {
        const mod = domain.replace("module:", "");
        const { readModuleLiveCached } = await import("@/lib/live/module-cache");
        const r = await readModuleLiveCached(mod);
        if (!r) {
          return { domain, count: 0, stale: true, cold: true, ageSeconds: null, updatedAt: null };
        }
        return { domain, count: r.data.length, stale: r.stale, cold: r.cold, ageSeconds: r.ageSeconds, updatedAt: r.updatedAt };
      }
      const ttlKey = domain.startsWith("flights:") ? "flights"
        : domain.startsWith("ships:") ? "ships"
        : domain.startsWith("webcams:") ? "webcams"
        : "iss";
      const source = domain.startsWith("flights:") ? "OpenSky/adsb.lol/Wingbits"
        : domain.startsWith("ships:") ? "AISHub"
        : domain.startsWith("webcams:") ? "Curated + Windy"
        : "wheretheiss.at";
      const r = await readLiveCached<Item[]>(
        domain,
        { ttlSeconds: LIVE_SOFT_TTL[ttlKey as keyof typeof LIVE_SOFT_TTL], source, fallback: [] },
      );
      return {
        domain,
        count: Array.isArray(r.data) ? r.data.length : r.data ? 1 : 0,
        stale: r.stale,
        cold: r.cold,
        ageSeconds: r.ageSeconds,
        updatedAt: r.updatedAt,
      };
    }),
  );

  const snapshots = Object.fromEntries(
    domainReads.map((d) => [
      d.domain,
      {
        count: d.count,
        stale: d.stale,
        cold: d.cold,
        ageSeconds: d.ageSeconds == null ? null : Math.round(d.ageSeconds),
        updatedAt: d.updatedAt,
      },
    ]),
  );

  const populatedDomains = Object.values(seedMeta).filter((m) => m && m.recordCount > 0).length;
  const anyStale = domainReads.some((d) => d.stale);
  const anyCold = domainReads.some((d) => d.cold);

  let cacheState: string;
  if (!redis.configured) {
    cacheState = "redis_not_configured";
  } else if (!redis.reachable) {
    cacheState = "redis_unreachable";
  } else if (anyCold && populatedDomains === 0) {
    cacheState = "not_seeded";
  } else if (anyStale) {
    cacheState = "stale";
  } else if (populatedDomains > 0) {
    cacheState = "healthy";
  } else {
    cacheState = "empty";
  }

  return NextResponse.json({
    cacheState,
    redis: {
      configured: redis.configured,
      reachable: redis.reachable,
      status: redis.status,
      latencyMs: redis.latencyMs,
      lastCheckedAt: redis.lastCheckedAt,
      errorCategory: redis.errorCategory,
    },
    seedMeta,
    snapshots,
    fetchedAt: new Date().toISOString(),
  });
}
