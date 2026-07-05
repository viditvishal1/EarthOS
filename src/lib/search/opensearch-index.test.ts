import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Item } from "@/lib/types";

describe("indexItemToOpenSearch", () => {
  const sample: Item = {
    id: "test:1",
    module: "news",
    connectorId: "rss",
    title: "Test headline",
    summary: "Summary",
    source: "Test",
    timestamp: "2026-01-01T00:00:00Z",
    tags: ["test"],
    entities: [],
    contentPolicy: "metadata_only",
  };

  beforeEach(() => {
    process.env.OPENSEARCH_URL = "https://search.example.com";
    process.env.OPENSEARCH_USERNAME = "user";
    process.env.OPENSEARCH_PASSWORD = "pass";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENSEARCH_URL;
    delete process.env.OPENSEARCH_USERNAME;
    delete process.env.OPENSEARCH_PASSWORD;
  });

  it("PUTs document to earthos index", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { indexItemToOpenSearch } = await import("./opensearch");
    const ok = await indexItemToOpenSearch(sample);
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://search.example.com/earthos/_doc/test%3A1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("returns false when OPENSEARCH_URL unset", async () => {
    delete process.env.OPENSEARCH_URL;
    const { indexItemToOpenSearch } = await import("./opensearch");
    expect(await indexItemToOpenSearch(sample)).toBe(false);
  });
});
