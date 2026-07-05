import { describe, expect, it } from "vitest";
import { t, navLabel } from "./index";

describe("i18n", () => {
  it("translates nav keys in hi and ar", () => {
    expect(navLabel("en", "settings", "Settings")).toBe("Settings");
    expect(navLabel("hi", "settings", "Settings")).not.toBe("Settings");
    expect(t("ar", "nav.cyber")).toContain("الاستخبارات");
  });
});
