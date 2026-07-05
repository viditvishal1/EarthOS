import { test, expect } from "@playwright/test";

test("findings badge opens modal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const badge = page.getByRole("button", { name: /findings/i }).first();
  await badge.click();
  await expect(page.getByRole("heading", { name: /Cross-domain findings/i })).toBeVisible();
});
