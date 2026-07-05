// Conflict & crisis connectors — ReliefWeb humanitarian updates (keyless RSS;
// the JSON API now requires an approved appname), UCDP georeferenced events
// (free access token as of 2026), ACLED political violence events (free key +
// registered email). Items are geolocated where the provider supplies
// coordinates so the module map can plot events.

import { XMLParser } from "fast-xml-parser";
import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

// processEntities off: ReliefWeb items carry enough HTML entities to trip the
// parser's expansion limit, and we strip/normalize the HTML ourselves anyway.
const rssParser = new XMLParser({ ignoreAttributes: false, processEntities: false });

function rssText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return v == null ? "" : String(v);
}

registerConnector(
  {
    id: "reliefweb_reports",
    module: "conflict",
    source: "ReliefWeb",
    sourceUrl: "https://reliefweb.int",
    scheduleSeconds: 900,
    contentPolicy: "excerpt_only",
    entityTypes: ["location", "event", "organization"],
  },
  async () => {
    // ReliefWeb's WAF 406s unknown bot user agents (including honest custom
    // ones) but allows standard CLI fetch tools. This RSS feed is published
    // for automated syndication, so identify as a generic fetch tool.
    const res = await fetchWithTimeout("https://reliefweb.int/updates/rss.xml", {
      timeoutMs: 12000,
      headers: { "User-Agent": "Wget/1.21.4" },
    });
    if (!res.ok) throw new Error(`ReliefWeb HTTP ${res.status}`);
    const doc = rssParser.parse(await res.text());
    interface RwRss { title?: unknown; link?: unknown; pubDate?: unknown; description?: unknown; guid?: unknown }
    let raw: RwRss[] = doc?.rss?.channel?.item ?? [];
    if (!Array.isArray(raw)) raw = [raw];
    return raw.slice(0, 40).map((r, i): Item => {
      const title = rssText(r.title);
      // ReliefWeb titles are usually "Country: headline" — use the prefix as
      // region when it looks like a place (short, no digits).
      const prefix = title.includes(":") ? title.split(":")[0].trim() : "";
      const country = prefix && prefix.length <= 30 && !/\d/.test(prefix) ? prefix : undefined;
      const link = rssText(r.link);
      return {
        id: `reliefweb:${rssText(r.guid) || link || i}`,
        module: "conflict",
        connectorId: "reliefweb_reports",
        title,
        summary: rssText(r.description)
          .replace(/&lt;[^&]*?&gt;/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400) || undefined,
        url: link || undefined,
        source: "ReliefWeb",
        timestamp: r.pubDate ? new Date(rssText(r.pubDate)).toISOString() : new Date().toISOString(),
        tags: ["humanitarian"],
        region: country,
        entities: country && country.length < 40 ? [{ name: country, type: "location" }] : [],
        contentPolicy: "excerpt_only",
      };
    });
  },
);

registerConnector(
  {
    id: "ucdp_events",
    module: "conflict",
    source: "UCDP",
    sourceUrl: "https://ucdp.uu.se",
    scheduleSeconds: 3600,
    contentPolicy: "full_cache",
    entityTypes: ["location", "event", "organization"],
    requiresKey: "UCDP_ACCESS_TOKEN",
  },
  async () => {
    // UCDP GED events — free access token required since 2026.
    const res = await fetchWithTimeout(
      "https://ucdpapi.pcr.uu.se/api/gedevents/25.1?pagesize=150&page=0",
      { timeoutMs: 15000, headers: { "x-ucdp-access-token": process.env.UCDP_ACCESS_TOKEN! } },
    );
    if (!res.ok) throw new Error(`UCDP HTTP ${res.status}`);
    const data = await res.json();
    interface UcdpEvent {
      id: number;
      country: string;
      side_a: string;
      side_b: string;
      date_end: string;
      latitude: number;
      longitude: number;
      best: number; // best fatality estimate
      type_of_violence: number;
      source_headline?: string;
      where_description?: string;
    }
    const violenceType: Record<number, string> = { 1: "state-based", 2: "non-state", 3: "one-sided" };
    return ((data.Result ?? []) as UcdpEvent[]).map((e): Item => ({
      id: `ucdp:${e.id}`,
      module: "conflict",
      connectorId: "ucdp_events",
      title: e.source_headline?.trim() || `${e.side_a} vs ${e.side_b} — ${e.where_description ?? e.country}`,
      summary: `${violenceType[e.type_of_violence] ?? "armed"} violence, ${e.country}. Best fatality estimate: ${e.best}.`,
      url: "https://ucdp.uu.se/exploratory",
      source: "UCDP GED",
      timestamp: new Date(e.date_end).toISOString(),
      lat: e.latitude,
      lon: e.longitude,
      severity: Math.min(10, Math.log2(1 + e.best) * 1.6),
      severityLabel: `${e.best} killed`,
      tags: ["armed-conflict", violenceType[e.type_of_violence] ?? "violence"],
      region: e.country,
      entities: [
        { name: e.country, type: "location" },
        { name: e.side_a, type: "organization" },
        { name: e.side_b, type: "organization" },
      ],
      contentPolicy: "full_cache",
    }));
  },
);

registerConnector(
  {
    id: "acled_events",
    module: "conflict",
    source: "ACLED",
    sourceUrl: "https://acleddata.com",
    scheduleSeconds: 3600,
    contentPolicy: "excerpt_only",
    entityTypes: ["location", "event", "organization"],
    requiresKey: "ACLED_API_KEY",
  },
  async () => {
    const key = process.env.ACLED_API_KEY!;
    const email = process.env.ACLED_EMAIL ?? "";
    const res = await fetchWithTimeout(
      `https://api.acleddata.com/acled/read?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&limit=150`,
      { timeoutMs: 15000 },
    );
    if (!res.ok) throw new Error(`ACLED HTTP ${res.status}`);
    const data = await res.json();
    interface AcledEvent {
      event_id_cnty: string;
      event_date: string;
      event_type: string;
      sub_event_type: string;
      actor1: string;
      country: string;
      location: string;
      latitude: string;
      longitude: string;
      fatalities: string;
      notes: string;
    }
    return ((data.data ?? []) as AcledEvent[]).map((e): Item => {
      const deaths = Number(e.fatalities) || 0;
      return {
        id: `acled:${e.event_id_cnty}`,
        module: "conflict",
        connectorId: "acled_events",
        title: `${e.event_type}: ${e.location}, ${e.country}`,
        summary: e.notes?.slice(0, 400),
        url: "https://acleddata.com/data-export-tool/",
        source: "ACLED",
        timestamp: new Date(e.event_date).toISOString(),
        lat: Number(e.latitude),
        lon: Number(e.longitude),
        severity: Math.min(10, deaths > 0 ? 3 + Math.log2(1 + deaths) * 1.4 : 2),
        severityLabel: deaths > 0 ? `${deaths} killed` : e.sub_event_type,
        tags: ["political-violence", e.event_type.toLowerCase().replace(/\s+/g, "-")],
        region: e.country,
        entities: [
          { name: e.country, type: "location" },
          ...(e.actor1 ? [{ name: e.actor1, type: "organization" as const }] : []),
        ],
        contentPolicy: "excerpt_only",
      };
    });
  },
);

export const CONFLICT_CONNECTOR_IDS = ["reliefweb_reports", "ucdp_events", "acled_events"];
