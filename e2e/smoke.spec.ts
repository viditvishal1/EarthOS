import { test, expect } from "@playwright/test";

test.describe("core pages", () => {
  test("home loads with Argus branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/ARG.*US/i).first()).toBeVisible();
  });

  test("methodology documents CII and findings", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { name: /Methodology/i })).toBeVisible();
    await expect(page.getByText(/Country Instability Index/i)).toBeVisible();
    await expect(page.getByText(/Cross-domain findings/i)).toBeVisible();
  });

  test("login page renders sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Sign in to Argus/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("country brief page loads", async ({ page }) => {
    await page.route("**/api/v1/country/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          iso2: "UA",
          country: "Ukraine",
          region: "Europe",
          cii: {
            score: 72,
            band: "elevated",
            coverageState: "partial",
            intelligenceGaps: [],
            components: [{ label: "Conflict", score: 80, evidenceCount: 3 }],
            methodologyVersion: "cii-v1",
          },
          findings: [],
          timeline: [],
          brief: null,
          disclaimer: "CII v1 is an editorial model from available public feeds.",
        }),
      });
    });
    await page.goto("/country/ua");
    await expect(page.getByRole("heading", { name: /Ukraine/i })).toBeVisible();
    await expect(page.getByText(/CII components/i)).toBeVisible();
  });
});

test.describe("dashboard", () => {
  test("panel grid mode loads", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Panel grid/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Add panel/i })).toBeVisible();
  });
});

test.describe("command palette", () => {
  test("opens from header control", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "K" }).click();
    await expect(page.getByPlaceholder(/Jump to a module/i)).toBeVisible();
  });

  test("opens with keyboard shortcut", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator("main").click();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder(/Jump to a module/i)).toBeVisible();
  });
});
