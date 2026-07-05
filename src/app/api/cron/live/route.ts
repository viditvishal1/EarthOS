import { NextRequest, NextResponse } from "next/server";
import { seedLiveDomains } from "@/lib/live/seed-cron";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) return process.env.NODE_ENV === "development";
  return req.headers.get("authorization") === `Bearer ${secret}` || req.headers.get("x-vercel-cron") === "1";
}

/** Fast-moving live domains — hit from external worker or manual refresh. */
export async function GET(req: NextRequest) {
  await trackApiRequest("/api/cron/live");
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const live = await seedLiveDomains();
  return NextResponse.json({ ok: true, ...live, fetchedAt: new Date().toISOString() });
}
