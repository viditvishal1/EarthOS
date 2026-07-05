import { NextRequest, NextResponse } from "next/server";
import { verifyCronBearer } from "@/lib/auth/cron-secret";
import { runScheduledIngestion } from "@/lib/ingest/scheduler";
import { legacyCountsFromDomains, seedLiveDomains } from "@/lib/live/seed-cron";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/ingest");
  if (!verifyCronBearer(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [result, liveSeed] = await Promise.all([
    runScheduledIngestion({ maxSources: 15 }),
    seedLiveDomains(),
  ]);
  return NextResponse.json({
    ok: true,
    ...result,
    live: {
      ...legacyCountsFromDomains(liveSeed.domains),
      domains: liveSeed.domains,
      durationMs: liveSeed.durationMs,
    },
    fetchedAt: new Date().toISOString(),
  });
}
