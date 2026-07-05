import { checkRedisHealth, redisCredentialScheme } from "@/lib/cache/redis";
import { cronSecretConfigured } from "@/lib/auth/cron-secret";
import { LIVE_SOFT_TTL, SEED_META_DOMAINS } from "@/lib/live/config";
import { readModuleLiveCached } from "@/lib/live/module-cache";
import { readAllSeedMeta, readSeedAttempt } from "@/lib/live/seed-meta";
import { readLiveCached } from "@/lib/live/store";
import type { Item } from "@/lib/types";

export type LiveKeyState = "missing" | "fresh" | "stale";

export interface LiveDomainHealth {
  state: LiveKeyState;
  count: number;
  ageSeconds: number | null;
  updatedAt: string | null;
  cold: boolean;
}

function keyState(stale: boolean, cold: boolean, count: number): LiveKeyState {
  if (cold || count === 0) return "missing";
  if (stale) return "stale";
  return "fresh";
}

export async function buildLiveDataHealth() {
  const redis = await checkRedisHealth();
  const scheme = redisCredentialScheme();
  const seedMeta = await readAllSeedMeta([...SEED_META_DOMAINS]);
  const lastAttempt = await readSeedAttempt();

  const domainReads = await Promise.all(
    SEED_META_DOMAINS.map(async (domain) => {
      if (domain.startsWith("module:")) {
        const mod = domain.replace("module:", "");
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

  const keys: Record<string, LiveDomainHealth> = {};
  for (const d of domainReads) {
    keys[d.domain] = {
      state: keyState(d.stale, d.cold, d.count),
      count: d.count,
      ageSeconds: d.ageSeconds == null ? null : Math.round(d.ageSeconds),
      updatedAt: d.updatedAt,
      cold: d.cold,
    };
  }

  const seededAt = Object.values(seedMeta)
    .filter((m): m is NonNullable<typeof m> => m != null && m.recordCount > 0)
    .map((m) => m.fetchedAt)
    .sort();
  const lastSuccessfulSeedAt = seededAt.length ? seededAt[seededAt.length - 1] : null;

  const allMetaTimes = Object.values(seedMeta)
    .filter((m): m is NonNullable<typeof m> => m != null)
    .map((m) => m.fetchedAt)
    .sort();
  const lastAttemptedSeedAt = lastAttempt?.attemptedAt
    ?? (allMetaTimes.length ? allMetaTimes[allMetaTimes.length - 1] : null);

  const keysPresent = domainReads.filter((d) => !d.cold && d.count > 0).map((d) => d.domain);

  return {
    redis: {
      configured: redis.configured,
      reachable: redis.reachable,
      scheme,
      latencyMs: redis.latencyMs,
      status: redis.status,
      errorCategory: redis.errorCategory,
    },
    cronSecretConfigured: cronSecretConfigured(),
    lastSuccessfulSeedAt,
    lastAttemptedSeedAt,
    keysPresent,
    keys,
    seedMeta,
    checkedAt: new Date().toISOString(),
  };
}
