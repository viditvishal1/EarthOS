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

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  const { id } = await ctx.params;
  await trackApiRequest("/api/investigations/detail");
  const c = await client();
  if (!c) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const [{ data: inv }, { data: evidence }, { data: notes }] = await Promise.all([
    c.from("investigations").select("*").eq("id", id).maybeSingle(),
    c.from("investigation_evidence").select("*").eq("investigation_id", id).order("pinned_at", { ascending: false }),
    c.from("investigation_notes").select("*").eq("investigation_id", id).order("created_at", { ascending: false }),
  ]);

  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ investigation: inv, evidence: evidence ?? [], notes: notes ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requirePrivateApi(req);
  if (isPrincipalError(auth)) return auth;
  const { id } = await ctx.params;
  const c = await client();
  if (!c) return NextResponse.json({ error: "database unavailable" }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (body.type === "note") {
    await c.from("investigation_notes").insert({
      investigation_id: id,
      body: String(body.body ?? "").slice(0, 5000),
      author: body.author ?? "analyst",
    });
  } else if (body.type === "evidence") {
    await c.from("investigation_evidence").insert({
      investigation_id: id,
      item_id: body.itemId ?? null,
      url: body.url ?? null,
      title: String(body.title ?? "Evidence").slice(0, 300),
      excerpt: body.excerpt ?? null,
      citation: body.citation ?? {},
    });
  } else if (body.status) {
    await c.from("investigations").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
