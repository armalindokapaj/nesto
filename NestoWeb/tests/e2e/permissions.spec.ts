import { test, expect } from "@playwright/test";

// Albanian is the app's default locale; these tests assert on English copy,
// so force the locale cookie before the first navigation in each test.
test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "nesto_locale", value: "en", url: baseURL }]);
});

async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/");
  await page.getByPlaceholder(/you@company.com or username/i).fill(username);
  await page.getByPlaceholder(/enter your password/i).fill("1");
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for the post-login redirect to land before navigating further —
  // otherwise an immediate page.goto() can race the server action's
  // redirect and fire before the session cookie is set.
  await page.waitForURL(/\/dashboard\//);
}

test("Architect lands on the architect dashboard and cannot open Finance", async ({ page }) => {
  await login(page, "elira.doda");
  await expect(page).toHaveURL(/\/dashboard\/architect/);
  await expect(page.getByRole("heading", { name: "Good morning, Design Team" })).toBeVisible();

  // Architect has NONE on FINANCE per the permission matrix — the dashboard
  // page itself redirects away rather than trusting client-side hiding alone.
  await page.goto("/dashboard/finance");
  await expect(page).toHaveURL(/\/dashboard\/executive/);
});

test("Finance user can open the Finance dashboard", async ({ page }) => {
  await login(page, "fatjon.dervishi");
  await page.goto("/dashboard/finance");
  await expect(page.getByRole("heading", { name: /finance team/i })).toBeVisible();
  await expect(page.getByText(/total revenue/i).first()).toBeVisible();
});

test("HR user can open the HR dashboard", async ({ page }) => {
  await login(page, "ana.krasniqi");
  await expect(page).toHaveURL(/\/dashboard\/hr/);
  await expect(page.getByText(/total employees/i)).toBeVisible();
});
