import { describe, expect, it } from "vitest";
import { toStooqSymbol } from "@/lib/markets/stooq";

describe("toStooqSymbol", () => {
  it("maps US equities", () => {
    expect(toStooqSymbol("AAPL")).toBe("aapl.us");
  });

  it("maps S&P 500 index", () => {
    expect(toStooqSymbol("^GSPC")).toBe("^spx");
  });
});
