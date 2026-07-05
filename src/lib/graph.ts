// Knowledge graph — Postgres adjacency tables in the PRD; implemented here as
// an in-process store with the same shape (entities, edges) so the storage
// backend can be swapped without touching the API or UI.

import type { EdgeType, GraphEdge, GraphEntity, Item } from "@/lib/types";
import { syncItemOntology } from "@/lib/ontology/store";

type GraphStore = {
  entities: Map<string, GraphEntity>;
  edges: Map<string, GraphEdge>;
  entityItems: Map<string, Item[]>;
};

const g = globalThis as unknown as { __earthosGraph?: GraphStore };
const store: GraphStore = (g.__earthosGraph ??= {
  entities: new Map(),
  edges: new Map(),
  entityItems: new Map(),
});

export function entityId(name: string, type: string): string {
  return `${type}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

const MODULE_EDGE: Record<string, EdgeType> = {
  news: "mentions",
  cyber: "affected_by",
  aviation: "operates",
  maritime: "operates",
  space: "operates",
  markets: "references",
  startup: "owns",
  government: "references",
  infrastructure: "impacts",
  earth: "located_in",
};

/** Ingest normalized items: upsert entities, connect co-occurring entities (inferred). */
export function ingestItems(items: Item[]) {
  for (const item of items) {
    void syncItemOntology(item).catch(() => {});
    const ids: string[] = [];
    for (const e of item.entities) {
      if (!e.name || e.name.length < 2) continue;
      const id = entityId(e.name, e.type);
      ids.push(id);
      const existing = store.entities.get(id);
      if (existing) {
        existing.degree += 1;
        existing.lastSeen = item.timestamp;
        if (!existing.modules.includes(item.module)) existing.modules.push(item.module);
      } else {
        store.entities.set(id, {
          id,
          name: e.name,
          type: e.type,
          degree: 1,
          modules: [item.module],
          firstSeen: item.timestamp,
          lastSeen: item.timestamp,
        });
      }
      const bucket = store.entityItems.get(id) ?? [];
      if (!bucket.some((b) => b.id === item.id)) {
        bucket.unshift(item);
        if (bucket.length > 25) bucket.pop();
        store.entityItems.set(id, bucket);
      }
    }
    // Co-occurrence edges: entities appearing in the same item are related.
    // Labeled kind:"inference" and carry the citable passage they came from —
    // confidence grows with corroborating observations instead of a flat 0.35.
    const edgeType = MODULE_EDGE[item.module] ?? "mentions";
    const passage = (item.summary ?? item.title).slice(0, 280);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort();
        const eid = `${a}--${b}`;
        const existing = store.edges.get(eid);
        if (existing) {
          existing.weight += 1;
          if (!existing.itemIds.includes(item.id)) {
            existing.itemIds.push(item.id);
            existing.confidence = Math.min(0.9, 0.35 + 0.05 * (existing.itemIds.length - 1));
            existing.evidence ??= [];
            if (existing.evidence.length < 5) {
              existing.evidence.push({ itemId: item.id, passage, source: item.source, observedAt: item.timestamp });
            }
          }
        } else {
          store.edges.set(eid, {
            id: eid,
            source: a,
            target: b,
            type: edgeType,
            itemIds: [item.id],
            weight: 1,
            confidence: 0.35,
            resolutionMethod: "inferred",
            kind: "inference",
            evidence: [{ itemId: item.id, passage, source: item.source, observedAt: item.timestamp }],
          });
        }
      }
    }
  }
}

export function graphSnapshot(opts?: { q?: string; type?: string; limit?: number }) {
  const { q, type, limit = 120 } = opts ?? {};
  let entities = [...store.entities.values()];
  if (type && type !== "all") entities = entities.filter((e) => e.type === type);
  if (q) entities = entities.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  entities.sort((a, b) => b.degree - a.degree);
  entities = entities.slice(0, limit);
  const keep = new Set(entities.map((e) => e.id));
  const edges = [...store.edges.values()].filter(
    (e) => keep.has(e.source) && keep.has(e.target),
  );
  return { entities, edges, totals: { entities: store.entities.size, edges: store.edges.size } };
}

export function entityNeighborhood(id: string) {
  const center = store.entities.get(id);
  if (!center) return null;
  const edges = [...store.edges.values()].filter((e) => e.source === id || e.target === id);
  const neighborIds = new Set<string>([id]);
  for (const e of edges) {
    neighborIds.add(e.source);
    neighborIds.add(e.target);
  }
  const entities = [...neighborIds]
    .map((nid) => store.entities.get(nid))
    .filter((e): e is GraphEntity => Boolean(e));
  return { center, entities, edges, items: store.entityItems.get(id) ?? [] };
}

// ---------- lightweight entity extraction (heuristic NER) ----------

const STOPWORDS = new Set([
  "The", "This", "That", "These", "Those", "A", "An", "In", "On", "At", "Of",
  "For", "And", "But", "Or", "As", "By", "To", "From", "With", "After",
  "Before", "Over", "Under", "New", "How", "Why", "What", "When", "Where",
  "Who", "Which", "Its", "His", "Her", "Their", "Our", "Your", "My", "It",
  "He", "She", "They", "We", "You", "I", "Is", "Are", "Was", "Were", "Will",
  "May", "Says", "Say", "Said", "Report", "Reports", "Breaking", "Live",
  "Update", "Updates", "Exclusive", "Watch", "Video", "Opinion", "Analysis",
]);

/**
 * Heuristic entity extraction for unstructured titles (news, HN):
 * capitalized multi-word phrases that aren't sentence-start stopwords.
 * Structured connectors (CVE vendors, airlines, vessels) pass explicit
 * entities instead and skip this entirely.
 */
export function extractEntitiesFromText(
  text: string,
): { name: string; type: "organization" }[] {
  const found = new Map<string, { name: string; type: "organization" }>();
  const re = /\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const words = m[1].split(/\s+/).filter((w) => !STOPWORDS.has(w));
    if (words.length === 0) continue;
    const name = words.join(" ");
    if (name.length < 3 || /^\d+$/.test(name)) continue;
    found.set(name.toLowerCase(), { name, type: "organization" });
    if (found.size >= 5) break;
  }
  return [...found.values()];
}
