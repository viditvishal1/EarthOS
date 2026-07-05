import { NextRequest, NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/ingest/cleanup";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/cleanup");
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRetentionCleanup();
  return NextResponse.json({ ok: true, ...result, fetchedAt: new Date().toISOString() });
}
