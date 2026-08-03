import { test, expect, type Page } from "@playwright/test";

// Drives PRD_9's core scope (personal calendar, HR-governed leave workflow,
// reminders, themes) — Team Availability and Google/Outlook sync are
// deliberately out of scope, per the PRD's own "release readiness" gate.
test.describe.configure({ mode: "serial" });

async function loginAs(page: Page, username: string, password = "1") {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "nesto_locale", value: "en", domain: "localhost", path: "/" }]);
  await page.goto("/");
  await page.getByPlaceholder(/you@company.com or username/i).fill(username);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test("Owner can reach Calendar from the topbar icon and it shows only their own items", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.waitForURL(/\/calendar/);
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByText("Only you can see this.")).toBeVisible();
});

test("Owner can add, edit and delete a personal agenda event", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/calendar");

  await page.getByRole("button", { name: "Add Event" }).first().click();
  await page.getByLabel("Title").fill("Site visit — Riverside");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Site visit — Riverside").first()).toBeVisible();

  await page.getByText("Site visit — Riverside").first().click();
  await page.getByLabel("Title").fill("Site visit — Riverside (rescheduled)");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Site visit — Riverside (rescheduled)").first()).toBeVisible();

  await page.getByText("Site visit — Riverside (rescheduled)").first().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Site visit — Riverside (rescheduled)")).not.toBeVisible();
});

test("Owner requests leave for themselves from Calendar, HR approves it, and it appears as approved leave", async ({ page }) => {
  await loginAs(page, "arben.kola", "Nesto2026!");
  await page.goto("/calendar");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  await page.getByRole("button", { name: "Request Leave" }).click();
  await page.getByLabel("Start Date").fill(iso(tomorrow));
  await page.getByLabel("End Date").fill(iso(dayAfter));
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await loginAs(page, "ana.krasniqi", "Nesto2026!");
  await page.goto("/dashboard/hr/leave");
  const row = page.locator("tr", { hasText: "Arben Kola" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED")).toBeVisible();

  await loginAs(page, "arben.kola", "Nesto2026!");
  await page.goto("/calendar");
  await expect(page.getByText("Approved leave").first()).toBeVisible();
});

test("A user can save their own reminder lead times", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/account");
  const remindersForm = page.locator("form", { has: page.locator("#reminder-MEETING") });
  await remindersForm.locator("#reminder-MEETING").selectOption("60");
  await remindersForm.getByRole("button", { name: "Save" }).click();

  await page.reload();
  await expect(page.locator("#reminder-MEETING")).toHaveValue("60");
});

function themeForm(page: Page) {
  return page.locator("form", { has: page.getByText("Platform Default", { exact: true }) });
}

test("Selecting a theme applies it immediately, with no separate Save step", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/account");

  const form = themeForm(page);
  await form.getByText("Night Mode", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await themeForm(page).getByText("Platform Default", { exact: true }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
});

test("Creative User Type Theme is no longer offered", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/account");
  await expect(page.getByText("Creative User Type Theme")).not.toBeVisible();
});
