// Ingest API — external connector workers (Rust/Node) POST normalized items
// here. Validates a shared secret, ingests into the graph + optional Supabase.

import { NextRequest, NextResponse } from "next/server";
import { ingestItems } from "@/lib/graph";
import { persistIngestedItems } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.EARTHOS_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "EARTHOS_INGEST_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { connectorId?: string; connector_id?: string; items?: Item[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const connectorId = body.connectorId ?? body.connector_id ?? "external";
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  ingestItems(items);
  await persistIngestedItems(items, connectorId);
  await publish({ type: "ingest.received", connectorId, itemCount: items.length });

  return NextResponse.json({ ok: true, ingested: items.length });
}
