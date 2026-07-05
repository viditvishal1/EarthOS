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
  await trackApiRequest("/api/investigations");
  const c = await client();
  if (!c) return NextResponse.json({ investigations: [], note: "Supabase service key required" });
  const { data } = await c.from("investigations").select("*").order("updated_at", { ascending: false }).limit(50);
  return NextResponse.json({ investigations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  await trackApiRequest("/api/investigations");
  const c = await client();
  if (!c) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const id = `inv_${Date.now().toString(36)}`;
  const title = String(body.title ?? "Untitled investigation").slice(0, 200);
  const { data, error } = await c.from("investigations").insert({
    id,
    title,
    status: "open",
    hypothesis: body.hypothesis ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ investigation: data });
}
