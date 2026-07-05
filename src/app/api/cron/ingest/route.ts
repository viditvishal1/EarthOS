import { NextRequest, NextResponse } from "next/server";
import { runScheduledIngestion } from "@/lib/ingest/scheduler";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/ingest");
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runScheduledIngestion({ maxSources: 15 });
  return NextResponse.json({
    ok: true,
    ...result,
    fetchedAt: new Date().toISOString(),
  });
}
