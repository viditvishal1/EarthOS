import { NextRequest, NextResponse } from "next/server";
import { getUsageSnapshot, SUPABASE_RESERVE_MB, SUPABASE_TARGET_MB } from "@/lib/usage/tracker";
import { loadFeatureFlags } from "@/lib/platform/feature-flags";
import { DEFAULT_RETENTION_HOURS } from "@/lib/storage/retention";
import { queueDepth } from "@/lib/queue/ingestion";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  await trackApiRequest("/api/usage");
  const [usage, flags] = await Promise.all([getUsageSnapshot(), loadFeatureFlags()]);

  return NextResponse.json({
    usage,
    featureFlags: flags,
    retentionDefaults: DEFAULT_RETENTION_HOURS,
    supabase: {
      targetMb: SUPABASE_TARGET_MB,
      reserveMb: SUPABASE_RESERVE_MB,
    },
    ingestionQueueDepth: queueDepth(),
    fetchedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const secret = (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) {
    return NextResponse.json({ error: "ARGUS_ADMIN_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { seedPlatformConfig } = await import("@/lib/db/platform");
  const result = await seedPlatformConfig();
  return NextResponse.json({ ok: true, ...result });
}
