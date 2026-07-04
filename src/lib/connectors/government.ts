// Government & Legal connectors — US Federal Register (free JSON API, no key),
// data.gov CKAN catalog search, CourtListener recent opinions (anonymous tier).

import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

registerConnector(
  {
    id: "federal_register",
    module: "government",
    source: "Federal Register",
    sourceUrl: "https://www.federalregister.gov",
    scheduleSeconds: 3600,
    contentPolicy: "excerpt_only",
    entityTypes: ["organization", "event"],
  },
  async () => {
    const res = await fetchWithTimeout(
      "https://www.federalregister.gov/api/v1/documents.json?per_page=25&order=newest&fields[]=title&fields[]=type&fields[]=abstract&fields[]=publication_date&fields[]=html_url&fields[]=agencies&fields[]=document_number",
      { timeoutMs: 12000 },
    );
    if (!res.ok) throw new Error(`Federal Register HTTP ${res.status}`);
    const data = await res.json();
    interface FrDoc {
      title: string; type: string; abstract: string | null;
      publication_date: string; html_url: string; document_number: string;
      agencies: { name?: string; raw_name?: string }[];
    }
    return (data.results as FrDoc[]).map((d): Item => ({
      id: `fedreg:${d.document_number}`,
      module: "government",
      connectorId: "federal_register",
      title: d.title,
      summary: d.abstract ?? undefined,
      source: "Federal Register",
      url: d.html_url,
      timestamp: new Date(d.publication_date).toISOString(),
      tags: ["regulation", d.type.toLowerCase().replace(/\s/g, "-")],
      region: "United States",
      entities: d.agencies
        .slice(0, 3)
        .map((a) => ({ name: a.name ?? a.raw_name ?? "US Government", type: "organization" as const })),
      contentPolicy: "excerpt_only",
    }));
  },
);

registerConnector(
  {
    id: "courtlistener_opinions",
    module: "government",
    source: "CourtListener",
    sourceUrl: "https://www.courtlistener.com",
    scheduleSeconds: 3600,
    contentPolicy: "excerpt_only",
    entityTypes: ["organization", "event"],
  },
  async () => {
    const res = await fetchWithTimeout(
      "https://www.courtlistener.com/api/rest/v4/search/?type=o&order_by=dateFiled%20desc&filed_after=" +
        new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      { timeoutMs: 15000 },
    );
    if (!res.ok) throw new Error(`CourtListener HTTP ${res.status} (anonymous tier is rate-limited)`);
    const data = await res.json();
    interface Opinion {
      caseName: string; court: string; dateFiled: string;
      absolute_url: string; docketNumber: string | null; snippet?: string;
      opinions?: { snippet?: string }[];
    }
    return (data.results as Opinion[]).slice(0, 20).map((o, i): Item => ({
      id: `court:${o.absolute_url ?? i}`,
      module: "government",
      connectorId: "courtlistener_opinions",
      title: o.caseName,
      summary: `${o.court} · filed ${o.dateFiled}${o.docketNumber ? ` · docket ${o.docketNumber}` : ""}`,
      body: o.opinions?.[0]?.snippet ?? o.snippet,
      source: "CourtListener",
      url: `https://www.courtlistener.com${o.absolute_url}`,
      timestamp: new Date(o.dateFiled).toISOString(),
      tags: ["court-opinion"],
      region: "United States",
      entities: [
        { name: o.court, type: "organization" },
        { name: o.caseName, type: "event" },
      ],
      contentPolicy: "excerpt_only",
    }));
  },
);

export const GOVERNMENT_CONNECTOR_IDS = ["federal_register", "courtlistener_opinions", "patentsview_recent"];

/** Search the data.gov CKAN catalog on demand. */
export async function searchDataGov(q: string): Promise<Item[]> {
  const res = await fetchWithTimeout(
    `https://catalog.data.gov/api/3/action/package_search?q=${encodeURIComponent(q)}&rows=15`,
    { timeoutMs: 12000 },
  );
  if (!res.ok) return [];
  const data = await res.json();
  interface Pkg {
    title: string; notes: string | null; metadata_modified: string;
    name: string; organization: { title: string } | null;
  }
  return (data.result.results as Pkg[]).map((p): Item => ({
    id: `datagov:${p.name}`,
    module: "government",
    connectorId: "datagov_search",
    title: p.title,
    summary: p.notes?.replace(/<[^>]+>/g, " ").slice(0, 300) ?? undefined,
    source: p.organization?.title ?? "data.gov",
    url: `https://catalog.data.gov/dataset/${p.name}`,
    timestamp: new Date(p.metadata_modified).toISOString(),
    tags: ["dataset"],
    region: "United States",
    entities: p.organization ? [{ name: p.organization.title, type: "organization" }] : [],
    contentPolicy: "metadata_only",
  }));
}
