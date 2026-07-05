import { buildLiveDataHealth } from "@/lib/live/health";
import { noCacheJson } from "@/lib/http/no-cache";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

/** Unified live-data diagnostics — no secrets or credential values. */
export async function GET() {
  await trackApiRequest("/api/health/live-data");
  const health = await buildLiveDataHealth();
  return noCacheJson(health);
}
