import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { acknowledgeAlerts } from "@/lib/alerts/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => Number(id)).filter((n: number) => Number.isFinite(n))
    : [];
  if (!ids.length) return noCacheJson({ error: "ids required" }, { status: 400 });
  const count = await acknowledgeAlerts(ids);
  return noCacheJson({ ok: true, acknowledged: count });
}
