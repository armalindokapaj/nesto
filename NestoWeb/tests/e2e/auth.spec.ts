import { test, expect } from "@playwright/test";
import { fillCredentials, signIn, submitSignIn, useEnglish } from "./helpers";

// Albanian is the app's default locale; these tests assert on English copy,
// so force the locale cookie before the first navigation in each test.
test.beforeEach(async ({ page, baseURL }) => {
  await useEnglish(page, baseURL);
});

test("landing page shows the Nesto login card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Sign in to Nesto/i })).toBeVisible();
  await expect(page.getByPlaceholder(/you@company.com or username/i)).toBeVisible();
});

test("rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await fillCredentials(page, "arben.kola", "wrong-password");
  await submitSignIn(page);
  await expect(page.getByText(/invalid credentials/i)).toBeVisible();
});

test("logs in and lands on the executive dashboard", async ({ page }) => {
  await signIn(page, "arben.kola");
  await expect(page).toHaveURL(/\/dashboard\/executive/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /financial overview/i })).toBeVisible();
});

test("unauthenticated visitor is redirected away from a protected route", async ({ page }) => {
  await page.goto("/dashboard/finance");
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/(\?.*)?$/);
  await expect(page.getByRole("heading", { name: /Sign in to Nesto/i })).toBeVisible();
});
