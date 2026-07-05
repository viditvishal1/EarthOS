import { describe, expect, it } from "vitest";
import { fetchEquityQuote } from "@/lib/markets/equity";
import { generateMarketInsight } from "@/lib/markets/insights";
import { toStooqSymbol } from "@/lib/markets/stooq";
import { fetchYahooQuote } from "@/lib/markets/yahoo";

describe("toStooqSymbol", () => {
  it("maps US equities", () => {
    expect(toStooqSymbol("AAPL")).toBe("aapl.us");
  });

  it("maps NSE tickers", () => {
    expect(toStooqSymbol("RELIANCE.NS")).toBe("reliance.ns");
  });

  it("maps S&P 500 index", () => {
    expect(toStooqSymbol("^GSPC")).toBe("^spx");
  });
});

describe("generateMarketInsight", () => {
  it("returns fallback when Gemini unavailable", async () => {
    const prev = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const insight = await generateMarketInsight({
      symbol: "AAPL",
      name: "Apple",
      kind: "stock",
      price: 200,
      changePct: 1.2,
      news: [],
    });
    expect(insight.aiEnabled).toBe(false);
    expect(insight.outlook).toBeDefined();
    if (prev) process.env.GEMINI_API_KEY = prev;
  });
});

describe("yahoo quote (integration)", () => {
  const run = process.env.RUN_INTEGRATION_TESTS === "1" ? it : it.skip;

  run("fetches AAPL from Yahoo", async () => {
    const q = await fetchYahooQuote("AAPL");
    expect(q).not.toBeNull();
    expect(q!.price).toBeGreaterThan(0);
  }, 15000);

  run("fetchEquityQuote prefers Yahoo", async () => {
    const q = await fetchEquityQuote("MSFT");
    expect(q).not.toBeNull();
    expect(q!.provider).toBe("Yahoo Finance");
  }, 15000);
});
