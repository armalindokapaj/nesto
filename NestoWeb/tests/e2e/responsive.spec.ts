import { test, expect } from "@playwright/test";

test.describe("responsive layout", () => {
  // Albanian is the app's default locale; these tests assert on English
  // copy, so force the locale cookie before the first navigation.
  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "nesto_locale", value: "en", url: baseURL }]);
  });

  test("login page renders correctly", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Sign in to Nesto/i })).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/login-${testInfo.project.name}.png`, fullPage: true });
  });

  test("executive dashboard and mobile nav work end to end", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByPlaceholder(/you@company.com or username/i).fill("arben.kola");
    await page.getByPlaceholder(/enter your password/i).fill("Nesto2026!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/executive/);
    await page.screenshot({ path: `test-results/screenshots/executive-${testInfo.project.name}.png`, fullPage: true });

    if (testInfo.project.name === "mobile") {
      // Sidebar is off-canvas on mobile until the hamburger opens it.
      await page.getByLabel("Open menu").click();
      await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
      await page.screenshot({ path: `test-results/screenshots/executive-mobile-nav-open.png`, fullPage: true });
    }
  });

  test("company admin dashboard renders users table and create-user dialog", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByPlaceholder(/you@company.com or username/i).fill("arben.kola");
    await page.getByPlaceholder(/enter your password/i).fill("Nesto2026!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard\//);
    await page.goto("/dashboard/admin");
    await expect(page.getByRole("heading", { name: /company admin dashboard/i })).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/admin-${testInfo.project.name}.png`, fullPage: true });
  });
});
