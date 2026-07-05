import { NextResponse } from "next/server";
import { connectorStatuses, fetchPlatformStatuses } from "@/lib/connectors";
import { aiEnabled } from "@/lib/ai";
import { checkSupabaseHealth, dbEnabled, dbUsesPublishableKey, supabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const platforms = await fetchPlatformStatuses().catch(() => []);
  const supabase = await checkSupabaseHealth();
  return NextResponse.json({
    connectors: connectorStatuses(),
    platforms,
    aiEnabled: aiEnabled(),
    supabase: {
      configured: dbEnabled(),
      url: supabaseUrl() ? supabaseUrl()!.replace(/https:\/\//, "") : null,
      mode: dbUsesPublishableKey() ? "publishable" : supabase.mode ?? null,
      ok: supabase.ok,
      error: supabase.error,
    },
    fetchedAt: new Date().toISOString(),
  });
}
