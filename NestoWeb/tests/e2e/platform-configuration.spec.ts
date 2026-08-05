import { test, expect } from "@playwright/test";

// Platform Configuration end-to-end. The unit tests pin the cascade logic;
// these confirm the surface actually renders and that switching a module off
// really does remove its link from the sidebar — the "no dead links" rule
// that 7 of the 8 module PRDs state as an acceptance criterion.

// Selects on form field names rather than placeholder text: the workspace
// renders in the tenant's locale (Albanian by default here), so copy-based
// locators are not stable.
async function loginAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/");

  const identifier = page.locator('input[name="identifier"]');
  const password = page.locator('input[name="password"]');

  // Both inputs are controlled by React state, so a fill that lands before
  // hydration is silently discarded on the next render. Fill, then assert the
  // value actually stuck before submitting.
  await identifier.waitFor({ state: "visible" });
  await expect(async () => {
    await identifier.fill("arben.kola");
    await password.fill("1");
    await expect(identifier).toHaveValue("arben.kola");
    await expect(password).toHaveValue("1");
  }).toPass({ timeout: 15_000 });

  await page
    .locator("form")
    .filter({ has: identifier })
    .getByRole("button")
    .last()
    .click();
  await page.waitForURL(/\/dashboard\//, { timeout: 20_000 });
}

test("configuration page lists the toggle catalog grouped by module", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto("/dashboard/admin/configuration");

  await expect(page.getByRole("heading", { name: "Platform Configuration" })).toBeVisible();
  // Module blocks render with their own cards.
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  // Node keys are shown so an admin can map a toggle to what it gates.
  await expect(page.getByText("documents.feature.tranzit")).toBeVisible();
  // Toggles are real switches, not decorative.
  await expect(page.getByRole("switch", { name: "Documents" }).first()).toBeVisible();
});

test("disabling a module removes its sidebar link and cascades to children", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto("/dashboard/admin/configuration");

  // The Documents link lives in the operations sidebar, not the admin one, so
  // the before/after check has to be made from a page in that workspace.
  const documentsLink = page.locator('nav a[href="/documents"]');

  await page.goto("/projects");
  await expect(documentsLink).toBeVisible();

  await page.goto("/dashboard/admin/configuration");
  await page.getByRole("switch", { name: "Documents" }).first().click();
  await expect(page.getByText("Module disabled")).toBeVisible();
  // Children now read as inherited-off rather than offering a live toggle.
  await expect(page.getByText("off via parent").first()).toBeVisible();

  // The nav entry is gone — no dead link left behind.
  await page.goto("/projects");
  await expect(documentsLink).toHaveCount(0);

  // Restore so the run leaves no persistent state behind.
  await page.goto("/dashboard/admin/configuration");
  await page.getByRole("switch", { name: "Documents" }).first().click();
  await page.goto("/projects");
  await expect(documentsLink).toBeVisible();
});
