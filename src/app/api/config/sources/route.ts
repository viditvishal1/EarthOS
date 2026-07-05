import { NextRequest, NextResponse } from "next/server";
import { getDataSources, getCityPresets, getMarketInstruments, invalidateConfigCache } from "@/lib/config/sources";
import { updateDataSource } from "@/lib/db/platform";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  await trackApiRequest("/api/config/sources");
  const [sources, cities, instruments] = await Promise.all([
    getDataSources(),
    getCityPresets(),
    getMarketInstruments(),
  ]);

  return NextResponse.json({
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      source_type: s.source_type,
      provider: s.provider,
      enabled: s.enabled,
      priority: s.priority,
      polling_interval_seconds: s.polling_interval_seconds,
      geographic_scope: s.geographic_scope,
      reliability_score: s.reliability_score,
      requires_api_key: s.requires_api_key,
    })),
    cities,
    instruments,
    fetchedAt: new Date().toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  const secret = (process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET);
  if (!secret) {
    return NextResponse.json({ error: "ARGUS_ADMIN_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ok = await updateDataSource(id, {
    enabled: body.enabled,
    priority: body.priority,
    config_json: body.config_json,
  });
  if (!ok) return NextResponse.json({ error: "update failed" }, { status: 500 });

  invalidateConfigCache();
  return NextResponse.json({ ok: true, id });
}
