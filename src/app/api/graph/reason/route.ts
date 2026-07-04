import { NextRequest, NextResponse } from "next/server";
import type { Item } from "@/lib/types";
import { askAnalyst, aiEnabled } from "@/lib/ai";
import { entityNeighborhood } from "@/lib/graph";
import { runConnectors, MODULE_CONNECTORS } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "Set GEMINI_API_KEY to enable neuro-symbolic reasoning" }, { status: 503 });
  }
  let body: { entityId?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const entityId = body.entityId;
  const question = body.question?.trim() ||
    "Explain this entity's role in the knowledge graph using symbolic relationships (who, where, impacts) and cite sources.";

  let contextItems: Item[] = [];
  let symbolic = { entity: null as unknown, neighbors: [] as unknown[], edges: [] as unknown[] };

  if (entityId) {
    const hood = entityNeighborhood(entityId);
    if (hood) {
      symbolic = {
        entity: hood.center,
        neighbors: hood.entities.filter((e) => e.id !== entityId).slice(0, 12),
        edges: hood.edges.slice(0, 20),
      };
      contextItems = hood.items;
    }
  }

  if (contextItems.length < 5) {
    const allIds = Object.values(MODULE_CONNECTORS).flat();
    const cached = await runConnectors(allIds.slice(0, 8));
    contextItems = [...contextItems, ...cached.slice(0, 25)];
  }

  const prompt = `${question}\n\nSymbolic graph context (entities + edges):\n${JSON.stringify(symbolic, null, 2).slice(0, 4000)}`;
  const { answer, sources } = await askAnalyst(prompt, contextItems);

  return NextResponse.json({
    answer,
    sources: sources.slice(0, 15),
    symbolic,
    mode: "neuro-symbolic",
  });
}
