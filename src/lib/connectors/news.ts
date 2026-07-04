// News Intelligence connectors — direct outlet RSS feeds (link straight to
// articles so the in-app reader can extract text) + Google News RSS for
// query-based search (metadata_only: its links are redirects, so we link out).

import { XMLParser } from "fast-xml-parser";
import type { Item } from "@/lib/types";
import { extractEntitiesFromText } from "@/lib/graph";
import { fetchWithTimeout, registerConnector } from "./framework";

const parser = new XMLParser({ ignoreAttributes: false });

const FEEDS: { source: string; url: string; tags: string[]; region?: string }[] = [
  { source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tags: ["world"], region: "Global" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss", tags: ["world"], region: "Global" },
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", tags: ["world"], region: "Global" },
  { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml", tags: ["world"], region: "US" },
  { source: "TechCrunch", url: "https://techcrunch.com/feed/", tags: ["technology"], region: "Global" },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tags: ["technology"], region: "Global" },
  { source: "The Verge", url: "https://www.theverge.com/rss/index.xml", tags: ["technology"], region: "Global" },
  { source: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", tags: ["world"], region: "India" },
];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return v == null ? "" : String(v);
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
  "content:encoded"?: unknown;
  guid?: unknown;
}

async function parseFeed(
  url: string,
  source: string,
  tags: string[],
  region?: string,
): Promise<Item[]> {
  const res = await fetchWithTimeout(url, { timeoutMs: 9000 });
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.feed;
  let raw: RssItem[] = channel?.item ?? channel?.entry ?? [];
  if (!Array.isArray(raw)) raw = [raw];
  return raw.slice(0, 20).map((r): Item => {
    const title = stripHtml(text(r.title));
    const link =
      typeof r.link === "object" && r.link !== null
        ? String((r.link as Record<string, unknown>)["@_href"] ?? "")
        : text(r.link);
    const desc = stripHtml(text(r.description ?? "")).slice(0, 400);
    const ts = text(r.pubDate) ? new Date(text(r.pubDate)).toISOString() : new Date().toISOString();
    return {
      id: `news:${source}:${text(r.guid) || link || title}`.slice(0, 200),
      module: "news",
      connectorId: `news_${source.toLowerCase().replace(/\W+/g, "_")}`,
      title,
      summary: desc,
      url: link,
      source,
      timestamp: ts,
      tags,
      region,
      entities: extractEntitiesFromText(title),
      contentPolicy: "excerpt_only",
    };
  });
}

for (const feed of FEEDS) {
  registerConnector(
    {
      id: `news_${feed.source.toLowerCase().replace(/\W+/g, "_")}`,
      module: "news",
      source: feed.source,
      sourceUrl: feed.url,
      scheduleSeconds: 300,
      contentPolicy: "excerpt_only",
      entityTypes: ["organization", "person", "location"],
    },
    () => parseFeed(feed.url, feed.source, feed.tags, feed.region),
  );
}

// ---- Google News editions: country-wise headlines + category topic feeds ----
// These power the country/category filter chips in the News module. Links are
// Google News redirects, so these are metadata_only (title + link out).

export const NEWS_COUNTRIES = [
  { code: "US", name: "United States", hl: "en-US", gl: "US", ceid: "US:en" },
  { code: "IN", name: "India", hl: "en-IN", gl: "IN", ceid: "IN:en" },
  { code: "GB", name: "United Kingdom", hl: "en-GB", gl: "GB", ceid: "GB:en" },
  { code: "AU", name: "Australia", hl: "en-AU", gl: "AU", ceid: "AU:en" },
  { code: "CA", name: "Canada", hl: "en-CA", gl: "CA", ceid: "CA:en" },
  { code: "SG", name: "Singapore", hl: "en-SG", gl: "SG", ceid: "SG:en" },
  { code: "AE", name: "UAE", hl: "en-AE", gl: "AE", ceid: "AE:en" },
];

export const NEWS_CATEGORIES = [
  "WORLD", "BUSINESS", "TECHNOLOGY", "SCIENCE", "SPORTS", "HEALTH", "ENTERTAINMENT",
];

function googleNewsItems(
  xml: string,
  connectorId: string,
  tags: string[],
  region?: string,
): Item[] {
  const doc = parser.parse(xml);
  let raw: RssItem[] = doc?.rss?.channel?.item ?? [];
  if (!Array.isArray(raw)) raw = [raw];
  return raw.slice(0, 20).map((r): Item => {
    const rawTitle = stripHtml(text(r.title));
    const sourceMatch = rawTitle.match(/\s-\s([^-]+)$/);
    const title = sourceMatch ? rawTitle.slice(0, sourceMatch.index) : rawTitle;
    return {
      id: `${connectorId}:${text(r.guid) || title}`.slice(0, 220),
      module: "news",
      connectorId,
      title,
      url: text(r.link),
      source: sourceMatch ? sourceMatch[1].trim() : "Google News",
      timestamp: text(r.pubDate) ? new Date(text(r.pubDate)).toISOString() : new Date().toISOString(),
      tags,
      region,
      entities: extractEntitiesFromText(title),
      contentPolicy: "metadata_only",
    };
  });
}

for (const c of NEWS_COUNTRIES) {
  registerConnector(
    {
      id: `gnews_country_${c.code.toLowerCase()}`,
      module: "news",
      source: `Google News (${c.name})`,
      sourceUrl: "https://news.google.com",
      scheduleSeconds: 600,
      contentPolicy: "metadata_only",
      entityTypes: ["organization", "person", "location"],
    },
    async () => {
      const url = `https://news.google.com/rss?hl=${c.hl}&gl=${c.gl}&ceid=${encodeURIComponent(c.ceid)}`;
      const res = await fetchWithTimeout(url, { timeoutMs: 9000 });
      if (!res.ok) throw new Error(`Google News ${c.code} HTTP ${res.status}`);
      return googleNewsItems(await res.text(), `gnews_country_${c.code.toLowerCase()}`, ["headlines"], c.name);
    },
  );
}

for (const cat of NEWS_CATEGORIES) {
  registerConnector(
    {
      id: `gnews_cat_${cat.toLowerCase()}`,
      module: "news",
      source: `Google News (${cat.charAt(0) + cat.slice(1).toLowerCase()})`,
      sourceUrl: "https://news.google.com",
      scheduleSeconds: 600,
      contentPolicy: "metadata_only",
      entityTypes: ["organization", "person", "location"],
    },
    async () => {
      const url = `https://news.google.com/rss/headlines/section/topic/${cat}?hl=en-US&gl=US&ceid=US:en`;
      const res = await fetchWithTimeout(url, { timeoutMs: 9000 });
      if (!res.ok) throw new Error(`Google News ${cat} HTTP ${res.status}`);
      return googleNewsItems(await res.text(), `gnews_cat_${cat.toLowerCase()}`, [cat.toLowerCase()], "Global");
    },
  );
}

export const NEWS_CONNECTOR_IDS = [
  ...FEEDS.map((f) => `news_${f.source.toLowerCase().replace(/\W+/g, "_")}`),
  ...NEWS_COUNTRIES.map((c) => `gnews_country_${c.code.toLowerCase()}`),
  ...NEWS_CATEGORIES.map((c) => `gnews_cat_${c.toLowerCase()}`),
];

/** Query-based search via Google News RSS (metadata + link out). */
export async function searchGoogleNews(q: string): Promise<Item[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetchWithTimeout(url, { timeoutMs: 9000 });
  if (!res.ok) return [];
  const doc = parser.parse(await res.text());
  let raw: RssItem[] = doc?.rss?.channel?.item ?? [];
  if (!Array.isArray(raw)) raw = [raw];
  return raw.slice(0, 15).map((r): Item => {
    const rawTitle = stripHtml(text(r.title));
    const sourceMatch = rawTitle.match(/\s-\s([^-]+)$/);
    const title = sourceMatch ? rawTitle.slice(0, sourceMatch.index) : rawTitle;
    return {
      id: `gnews:${text(r.guid) || title}`.slice(0, 200),
      module: "news",
      connectorId: "google_news_search",
      title,
      url: text(r.link),
      source: sourceMatch ? sourceMatch[1].trim() : "Google News",
      timestamp: text(r.pubDate) ? new Date(text(r.pubDate)).toISOString() : new Date().toISOString(),
      tags: ["search"],
      entities: extractEntitiesFromText(title),
      contentPolicy: "metadata_only",
    };
  });
}
