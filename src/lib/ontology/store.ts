// Ontology persistence — sync in-memory graph ingest to Supabase entity master.

import { dbEnabled } from "@/lib/db";
import type { Item } from "@/lib/types";
import { entityId } from "@/lib/graph";
import { isFeatureEnabled } from "@/lib/platform/feature-flags";
import { indexItemToOpenSearch } from "@/lib/search/opensearch";

async function serviceClient() {
  if (!dbEnabled() || !process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export async function upsertEntityFromItem(item: Item, entity: { name: string; type: string }): Promise<void> {
  const c = await serviceClient();
  if (!c) return;
  const id = entityId(entity.name, entity.type);
  const now = new Date().toISOString();
  await c.from("entities").upsert({
    id,
    object_type: entity.type,
    canonical_name: entity.name,
    resolution_method: "heuristic",
    confidence: 0.5,
    last_seen: now,
    first_seen: now,
    metadata: { modules: [item.module] },
  }, { onConflict: "id" });

  await c.from("entity_aliases").upsert({
    entity_id: id,
    alias: entity.name,
    alias_normalized: entity.name.toLowerCase().replace(/[^a-z0-9]+/g, " "),
    source_id: item.connectorId,
  }, { onConflict: "entity_id,alias_normalized" });
}

export async function upsertInferredRelationship(
  sourceId: string,
  targetId: string,
  relationshipType: string,
  item: Item,
  confidence = 0.4,
): Promise<void> {
  const c = await serviceClient();
  if (!c) return;
  const [a, b] = [sourceId, targetId].sort();
  const id = `rel:${a}:${b}:${relationshipType}`;
  await c.from("entity_relationships").upsert({
    id,
    source_entity_id: a,
    target_entity_id: b,
    relationship_type: relationshipType,
    confidence,
    resolution_method: "inferred",
    source_id: item.connectorId,
    source_url: item.url ?? null,
    item_id: item.id,
    valid_from: item.timestamp,
  }, { onConflict: "id" });
}

export async function indexItemForSearch(item: Item): Promise<void> {
  const c = await serviceClient();
  if (!c) return;
  await c.from("search_documents").upsert({
    id: item.id,
    module: item.module,
    source_id: item.connectorId,
    title: item.title,
    summary: item.summary ?? null,
    body: item.body?.slice(0, 5000) ?? null,
    url: item.url ?? null,
    published_at: item.timestamp,
    ingested_at: new Date().toISOString(),
    tags: item.tags,
    entity_ids: item.entities.map((e) => entityId(e.name, e.type)),
  }, { onConflict: "id" });

  if (await isFeatureEnabled("opensearch")) {
    await indexItemToOpenSearch(item).catch(() => {});
  }
}

export async function syncItemOntology(item: Item): Promise<void> {
  for (const e of item.entities) {
    if (!e.name || e.name.length < 2) continue;
    await upsertEntityFromItem(item, e).catch(() => {});
  }
  const ids = item.entities
    .filter((e) => e.name?.length >= 2)
    .map((e) => entityId(e.name, e.type));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      await upsertInferredRelationship(ids[i], ids[j], "related_to", item, 0.35).catch(() => {});
    }
  }
  await indexItemForSearch(item).catch(() => {});
}

export async function getEntity360(id: string) {
  const c = await serviceClient();
  if (!c) return null;

  const { data: entity } = await c.from("entities").select("*").eq("id", id).maybeSingle();
  if (!entity) return null;

  const [{ data: aliases }, { data: identifiers }, { data: relationships }, { data: docs }] = await Promise.all([
    c.from("entity_aliases").select("*").eq("entity_id", id),
    c.from("entity_identifiers").select("*").eq("entity_id", id),
    c.from("entity_relationships").select("*").or(`source_entity_id.eq.${id},target_entity_id.eq.${id}`).limit(50),
    c.from("search_documents").select("*").contains("entity_ids", [id]).order("ingested_at", { ascending: false }).limit(20),
  ]);

  return { entity, aliases: aliases ?? [], identifiers: identifiers ?? [], relationships: relationships ?? [], documents: docs ?? [] };
}

/** Wikidata lookup for entity enrichment (best-effort, no key required). */
export async function enrichFromWikidata(name: string): Promise<{ wikidataId?: string; description?: string } | null> {
  try {
    const q = encodeURIComponent(name);
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=en&format=json&limit=1`,
      { headers: { "User-Agent": "Argus/2.0" }, next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.search?.[0];
    if (!hit) return null;
    return { wikidataId: hit.id, description: hit.description };
  } catch {
    return null;
  }
}
