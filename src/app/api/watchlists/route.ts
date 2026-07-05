import { NextRequest, NextResponse } from "next/server";
import { dbEnabled } from "@/lib/db";
import { trackApiRequest } from "@/lib/usage/tracker";
import { isPrincipalError, requirePrivateApi } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

async function client() {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return createClient(url!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  await trackApiRequest("/api/watchlists");
  const c = await client();
  if (!c) return NextResponse.json({ watchlists: [], note: "Supabase service key required" });
  const { data } = await c.from("watchlists").select("*").order("updated_at", { ascending: false }).limit(50);
  return NextResponse.json({ watchlists: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  await trackApiRequest("/api/watchlists");
  const c = await client();
  if (!c) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const id = body.id ?? `wl_${Date.now().toString(36)}`;
  const { data, error } = await c.from("watchlists").upsert({
    id,
    name: String(body.name ?? "Watchlist").slice(0, 120),
    entity_ids: body.entityIds ?? [],
    symbols: body.symbols ?? [],
    updated_at: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data });
}
