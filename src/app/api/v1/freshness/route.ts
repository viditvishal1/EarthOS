import { noCacheJson } from "@/lib/http/no-cache";
import { buildFreshnessSnapshot } from "@/lib/freshness/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildFreshnessSnapshot();
  return noCacheJson({
    ...snapshot,
    fetchedAt: new Date().toISOString(),
  });
}
