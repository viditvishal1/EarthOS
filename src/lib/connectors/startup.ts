// Startup Intelligence connectors — trending GitHub repositories (search API,
// anonymous), Hacker News front page + Show HN (Algolia API, free).

import type { Item } from "@/lib/types";
import { extractEntitiesFromText } from "@/lib/graph";
import { fetchWithTimeout, registerConnector } from "./framework";

registerConnector(
  {
    id: "github_trending",
    module: "startup",
    source: "GitHub",
    sourceUrl: "https://github.com",
    scheduleSeconds: 900,
    contentPolicy: "full_cache",
    entityTypes: ["repository", "organization", "technology"],
  },
  async () => {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await fetchWithTimeout(
      `https://api.github.com/search/repositories?q=created:%3E${since}&sort=stars&order=desc&per_page=30`,
      { timeoutMs: 12000, headers: { Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status} (anonymous search: 10 req/min)`);
    const data = await res.json();
    interface Repo {
      full_name: string; description: string | null; html_url: string;
      stargazers_count: number; language: string | null; created_at: string;
      owner: { login: string }; topics?: string[]; forks_count: number;
      open_issues_count: number;
    }
    return (data.items as Repo[]).map((r): Item => ({
      id: `repo:${r.full_name}`,
      module: "startup",
      connectorId: "github_trending",
      title: r.full_name,
      summary: `${r.description ?? "No description"} · ★ ${r.stargazers_count.toLocaleString()}${r.language ? ` · ${r.language}` : ""}`,
      source: "GitHub",
      url: r.html_url,
      timestamp: r.created_at,
      severity: Math.min(10, Math.log10(Math.max(1, r.stargazers_count)) * 2.5),
      severityLabel: `★ ${r.stargazers_count.toLocaleString()}`,
      tags: ["github", ...(r.language ? [r.language.toLowerCase()] : []), ...(r.topics ?? []).slice(0, 3)],
      entities: [
        { name: r.full_name, type: "repository" },
        { name: r.owner.login, type: "organization" },
        ...(r.language ? [{ name: r.language, type: "technology" as const }] : []),
      ],
      contentPolicy: "full_cache",
      extra: {
        stars: r.stargazers_count,
        forks: r.forks_count,
        issues: r.open_issues_count,
        language: r.language,
        repo: r.full_name,
      },
    }));
  },
);

function hnConnector(id: string, tags: string, label: string) {
  registerConnector(
    {
      id,
      module: "startup",
      source: `Hacker News (${label})`,
      sourceUrl: "https://news.ycombinator.com",
      scheduleSeconds: 600,
      contentPolicy: "metadata_only",
      entityTypes: ["organization", "technology"],
    },
    async () => {
      const res = await fetchWithTimeout(
        `https://hn.algolia.com/api/v1/search?tags=${tags}&hitsPerPage=25`,
      );
      if (!res.ok) throw new Error(`HN Algolia HTTP ${res.status}`);
      const data = await res.json();
      interface Hit {
        objectID: string; title: string; url: string | null; points: number;
        num_comments: number; created_at: string; author: string;
      }
      return (data.hits as Hit[]).map((h): Item => ({
        id: `hn:${h.objectID}`,
        module: "startup",
        connectorId: id,
        title: h.title,
        summary: `${h.points} points · ${h.num_comments} comments · by ${h.author}`,
        source: `Hacker News (${label})`,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        timestamp: h.created_at,
        severity: Math.min(10, h.points / 100),
        severityLabel: `${h.points} pts`,
        tags: ["hackernews", label.toLowerCase().replace(/\s/g, "-")],
        entities: extractEntitiesFromText(h.title),
        contentPolicy: "metadata_only",
        extra: { hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}` },
      }));
    },
  );
}

hnConnector("hn_front", "front_page", "Front Page");
hnConnector("hn_show", "show_hn", "Show HN");

// Product Hunt — GraphQL API (key-gated: PRODUCTHUNT_API_TOKEN)
registerConnector(
  {
    id: "producthunt_today",
    module: "startup",
    source: "Product Hunt",
    sourceUrl: "https://www.producthunt.com",
    scheduleSeconds: 900,
    contentPolicy: "metadata_only",
    entityTypes: ["organization", "technology"],
    requiresKey: "PRODUCTHUNT_API_TOKEN",
  },
  async () => {
    const token = process.env.PRODUCTHUNT_API_TOKEN!;
    const res = await fetchWithTimeout("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      timeoutMs: 12000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `query { posts(order: VOTES, first: 25) { edges { node {
          id name tagline url votesCount commentsCount createdAt
          website topics { edges { node { name } } }
        } } } }`,
      }),
    });
    if (!res.ok) throw new Error(`Product Hunt HTTP ${res.status}`);
    const data = await res.json();
    interface PhNode {
      id: string; name: string; tagline: string; url: string;
      votesCount: number; commentsCount: number; createdAt: string; website?: string;
      topics?: { edges: { node: { name: string } }[] };
    }
    const edges: { node: PhNode }[] = data?.data?.posts?.edges ?? [];
    return edges.map(({ node: p }): Item => ({
      id: `ph:${p.id}`,
      module: "startup",
      connectorId: "producthunt_today",
      title: p.name,
      summary: `${p.tagline} · ${p.votesCount} votes · ${p.commentsCount} comments`,
      source: "Product Hunt",
      url: p.url,
      timestamp: p.createdAt,
      severity: Math.min(10, p.votesCount / 50),
      severityLabel: `${p.votesCount} votes`,
      tags: ["producthunt", ...(p.topics?.edges?.map((e) => e.node.name.toLowerCase()) ?? []).slice(0, 3)],
      entities: extractEntitiesFromText(`${p.name} ${p.tagline}`),
      contentPolicy: "metadata_only",
      extra: { website: p.website },
    }));
  },
);

export const STARTUP_CONNECTOR_IDS = ["github_trending", "hn_front", "hn_show", "producthunt_today"];

/** Fetch a repository README (raw markdown) for in-app rendering. */
export async function fetchReadme(repo: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const res = await fetchWithTimeout(`https://api.github.com/repos/${repo}/readme`, {
    headers: { Accept: "application/vnd.github.raw+json" },
    timeoutMs: 10000,
  });
  if (!res.ok) return null;
  return res.text();
}
