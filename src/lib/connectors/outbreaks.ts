/**
 * WHO Disease Outbreak News connector (G08/G13 health domain depth).
 */

import { XMLParser } from "fast-xml-parser";
import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

function rssText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return v == null ? "" : String(v);
}

registerConnector(
  {
    id: "who_disease_outbreaks",
    module: "conflict",
    source: "WHO DON",
    sourceUrl: "https://www.who.int",
    scheduleSeconds: 3600,
    contentPolicy: "excerpt_only",
    entityTypes: ["location", "event"],
  },
  async () => {
    const res = await fetchWithTimeout("https://www.who.int/feeds/entity/csr/don/en/rss.xml", {
      timeoutMs: 15000,
      headers: { "User-Agent": "ArgusBot/1.0" },
    });
    if (!res.ok) throw new Error(`who_rss_${res.status}`);
    const doc = parser.parse(await res.text());
    interface RssItem { title?: unknown; link?: unknown; pubDate?: unknown; description?: unknown; guid?: unknown }
    let raw: RssItem[] = doc?.rss?.channel?.item ?? [];
    if (!Array.isArray(raw)) raw = [raw];
    return raw.slice(0, 30).map((r, i): Item => {
      const title = rssText(r.title);
      const country = title.includes("–") ? title.split("–")[0].trim() : undefined;
      return {
        id: `who:${rssText(r.guid) || i}`,
        module: "conflict",
        connectorId: "who_disease_outbreaks",
        title,
        summary: rssText(r.description).replace(/<[^>]+>/g, " ").slice(0, 300),
        url: rssText(r.link) || undefined,
        source: "WHO",
        timestamp: r.pubDate ? new Date(rssText(r.pubDate)).toISOString() : new Date().toISOString(),
        tags: ["outbreak", "health", "who"],
        region: country,
        severity: 6,
        entities: country ? [{ name: country, type: "location" }] : [],
        contentPolicy: "excerpt_only",
      };
    });
  },
);

export const OUTBREAKS_CONNECTOR_ID = "who_disease_outbreaks";
