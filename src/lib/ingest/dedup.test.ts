import { describe, expect, it } from "vitest";
import { canonicalUrlHash, dedupeByKey, headlineSimHash } from "@/lib/ingest/dedup";

describe("dedup", () => {
  it("hashes canonical URLs consistently", () => {
    const a = canonicalUrlHash("https://Example.com/path#frag");
    const b = canonicalUrlHash("https://example.com/path");
    expect(a).toBe(b);
  });

  it("dedupes by key function", () => {
    const items = [{ id: "1" }, { id: "1" }, { id: "2" }];
    expect(dedupeByKey(items, (i) => i.id)).toHaveLength(2);
  });

  it("simhash is stable for same headline", () => {
    expect(headlineSimHash("Breaking: Fire in Oregon")).toBe(headlineSimHash("breaking fire in oregon"));
  });
});
