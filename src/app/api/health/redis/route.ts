import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/cache/redis";
import { noCacheJson } from "@/lib/http/no-cache";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

/** Server-only Redis health — never exposes credentials or tokens. */
export async function GET() {
  await trackApiRequest("/api/health/redis");
  const health = await checkRedisHealth();
  return noCacheJson({
    configured: health.configured,
    reachable: health.reachable,
    scheme: health.scheme,
    status: health.status,
    latencyMs: health.latencyMs,
    lastCheckedAt: health.lastCheckedAt,
    errorCategory: health.errorCategory,
    productionMode: health.productionMode,
    usingMemoryFallback: health.usingMemoryFallback,
  });
}
