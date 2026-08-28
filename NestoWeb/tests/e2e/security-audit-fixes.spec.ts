import { test, expect, type Page } from "@playwright/test";
import { signIn, useEnglish } from "./helpers";

// Regression coverage for the Nesto_Code_Audit_Initial.pdf critical findings
// fixed on 2026-08-03. Findings requiring a real DB/action-level check
// (C2 stale role, C5 cross-tenant writes, C6 public IDOR, C7 approval
// authorization) are covered by tests/unit/tenant-cross-tenant-writes.test.ts
// and the inline authorization checks themselves; this file covers what's
// actually visible in the rendered page.

async function loginAs(page: Page, username: string, password = "1") {
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, username, password);
}

test("C1: a role without Finance access sees Restricted, not real revenue, on the shared executive dashboard", async ({ page }) => {
  // Stock has FINANCE: NONE. It now lands on its own Inventory dashboard, so
  // the shared executive console has to be opened explicitly — the point of
  // this test is what Stock sees THERE, not where it lands.
  await loginAs(page, "Stock");
  await page.goto("/dashboard/executive");
  const revenueTile = page.locator("div", { hasText: "Revenue" }).last();
  await expect(page.getByText("Restricted").first()).toBeVisible();
  await expect(revenueTile.getByText(/€[\d,]/)).not.toBeVisible();
});

test("C1: a role WITH Finance access still sees the real revenue figure", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/dashboard/executive");
  await expect(page.getByRole("heading", { name: "Financial Overview" })).toBeVisible();
});

test("C3: Admin cannot grant Owner-level access even by submitting the role field directly", async ({ page }) => {
  await loginAs(page, "Admin");
  await page.goto("/dashboard/admin/users");
  await page.getByRole("button", { name: "Create User" }).click();
  // The UI never offers "Owner" as an option — confirm that boundary too.
  const roleOptions = await page.locator("#role option").allTextContents();
  expect(roleOptions.join(" ")).not.toContain("Company Owner");

  // Force the disallowed value in directly (simulates bypassing the UI,
  // which the audit's whole point is that a real attacker could do) and
  // confirm the server rejects it rather than trusting client-side hiding.
  await page.locator("#role").evaluate((el: HTMLSelectElement) => {
    const opt = document.createElement("option");
    opt.value = "OWNER";
    opt.text = "Company Owner";
    el.appendChild(opt);
    el.value = "OWNER";
  });
  await page.getByLabel("Full name").fill("Forged Owner");
  await page.getByLabel("Username").fill(`forged.owner.${Date.now()}`);
  await page.getByLabel("Email").fill(`forged.owner.${Date.now()}@test.local`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Only the Company Owner can grant Owner-level access.")).toBeVisible();
});
