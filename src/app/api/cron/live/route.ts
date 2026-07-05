import { NextRequest } from "next/server";
import { verifyCronBearer } from "@/lib/auth/cron-secret";
import { checkRedisHealth, isProductionRuntime } from "@/lib/cache/redis";
import { noCacheJson } from "@/lib/http/no-cache";
import { acquireLiveSeedLock, releaseLiveSeedLock } from "@/lib/live/lock";
import {
  formatCronDomainSummaries,
  legacyCountsFromDomains,
  seedLiveDomains,
} from "@/lib/live/seed-cron";
import { writeSeedAttempt } from "@/lib/live/seed-meta";
import { trackApiRequest } from "@/lib/usage/tracker";
import { incrementCounter, observeDuration } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Fast-moving live domains — triggered by Supabase Cron, Rust worker, or manual warm. */
export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/live");

  if (!verifyCronBearer(req.headers.get("authorization"))) {
    return noCacheJson({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const redisHealth = await checkRedisHealth();

  if (isProductionRuntime() && !redisHealth.configured) {
    return noCacheJson(
      {
        ok: false,
        error: "redis_not_configured",
        redis: { configured: false, reachable: false, scheme: redisHealth.scheme, status: redisHealth.status },
        startedAt,
        completedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  if (isProductionRuntime() && redisHealth.configured && !redisHealth.reachable) {
    return noCacheJson(
      {
        ok: false,
        error: "redis_unreachable",
        redis: {
          configured: true,
          reachable: false,
          scheme: redisHealth.scheme,
          status: redisHealth.status,
          errorCategory: redisHealth.errorCategory,
        },
        startedAt,
        completedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  const lock = await acquireLiveSeedLock();
  if (!lock.acquired) {
    return noCacheJson(
      {
        ok: false,
        error: "seed_already_running",
        message: "Another live seed is in progress",
        startedAt,
        completedAt: new Date().toISOString(),
      },
      { status: 409 },
    );
  }

  try {
    const runStarted = Date.now();
    const result = await seedLiveDomains();
    const completedAt = new Date().toISOString();
    const legacy = legacyCountsFromDomains(result.domains);
    const domains = formatCronDomainSummaries(result.domains);
    const ok = result.redisWriteFailures === 0
      && Object.values(domains).some((d) => d.status === "success" || d.status === "preserved-last-known-good");

    await writeSeedAttempt({
      attemptedAt: completedAt,
      ok,
      durationMs: result.durationMs,
    });

    const body = {
      ok,
      redis: {
        configured: redisHealth.configured,
        reachable: redisHealth.reachable,
        scheme: redisHealth.scheme,
        status: redisHealth.status,
        latencyMs: redisHealth.latencyMs,
      },
      domains,
      domainsDetail: result.domains,
      durationMs: result.durationMs,
      redisWriteFailures: result.redisWriteFailures,
      startedAt,
      completedAt,
      ...legacy,
    };

    if (isProductionRuntime() && result.redisWriteFailures > 0) {
      observeDuration("cron_live_seed", Date.now() - runStarted);
      incrementCounter("cron_live_runs", { status: "error" });
      return noCacheJson(body, { status: 503 });
    }

    observeDuration("cron_live_seed", Date.now() - runStarted);
    incrementCounter("cron_live_runs", { status: ok ? "ok" : "partial" });

    return noCacheJson(body);
  } finally {
    await releaseLiveSeedLock(lock.token);
  }
}
