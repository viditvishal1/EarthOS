// Patents connector — USPTO PatentsView search API (free, keyless).
// Recent utility patents with in-app PDF links where available.

import type { Item } from "@/lib/types";
import { extractEntitiesFromText } from "@/lib/graph";
import { fetchWithTimeout, registerConnector } from "./framework";

registerConnector(
  {
    id: "patentsview_recent",
    module: "government",
    source: "USPTO PatentsView",
    sourceUrl: "https://patentsview.org",
    scheduleSeconds: 3600,
    contentPolicy: "excerpt_only",
    entityTypes: ["organization", "technology"],
  },
  async () => {
    const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const res = await fetchWithTimeout("https://search.patentsview.org/api/v1/patent/", {
      method: "POST",
      timeoutMs: 15000,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: { _gte: { patent_date: since } },
        f: [
          "patent_id", "patent_title", "patent_date", "patent_abstract",
          "assignees.assignee_organization", "inventors.inventor_name_first",
          "inventors.inventor_name_last",
        ],
        o: { patent_date: "desc" },
        s: [{ patent_date: "desc" }],
        options: { size: 30 },
      }),
    });
    if (!res.ok) throw new Error(`PatentsView HTTP ${res.status}`);
    const data = await res.json();
    interface PatentRow {
      patent_id: string;
      patent_title: string;
      patent_date: string;
      patent_abstract?: string;
      assignees?: { assignee_organization?: string }[];
    }
    const rows: PatentRow[] = data.patents ?? data.results ?? [];
    return rows.map((p): Item => {
      const assignee = p.assignees?.[0]?.assignee_organization;
      const pdfUrl = `https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/${p.patent_id}`;
      return {
        id: `patent:${p.patent_id}`,
        module: "government",
        connectorId: "patentsview_recent",
        title: p.patent_title,
        summary: (p.patent_abstract ?? "").slice(0, 400),
        url: pdfUrl,
        source: "USPTO PatentsView",
        timestamp: `${p.patent_date}T12:00:00Z`,
        tags: ["patent", "pdf"],
        entities: [
          ...(assignee ? [{ name: assignee, type: "organization" as const }] : []),
          ...extractEntitiesFromText(p.patent_title),
        ],
        contentPolicy: "excerpt_only",
        extra: { patentId: p.patent_id, pdfUrl },
      };
    });
  },
);

export const PATENTS_CONNECTOR_IDS = ["patentsview_recent"];
