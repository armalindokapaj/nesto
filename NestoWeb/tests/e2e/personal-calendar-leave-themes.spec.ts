import { test, expect, type Page } from "@playwright/test";
import { signIn, setEnglishLocale } from "./helpers";

// Drives PRD_9's core scope (personal calendar, HR-governed leave workflow,
// reminders, themes) — Team Availability and Google/Outlook sync are
// deliberately out of scope, per the PRD's own "release readiness" gate.
test.describe.configure({ mode: "serial" });

async function loginAs(page: Page, username: string, password = "1") {
  await page.context().clearCookies();
  await setEnglishLocale(page);
  await signIn(page, username, password);
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
  await loginAs(page, "arben.kola", "1");
  await page.goto("/calendar");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  await page.getByRole("button", { name: "Request Leave" }).click();
  await page.getByLabel("Start Date").fill(iso(tomorrow));
  await page.getByLabel("End Date").fill(iso(dayAfter));
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await loginAs(page, "ana.krasniqi", "1");
  await page.goto("/dashboard/hr/leave");
  const row = page.locator("tr", { hasText: "Arben Kola" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED")).toBeVisible();

  await loginAs(page, "arben.kola", "1");
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

/**
 * Selecting a theme fires a server action; the attribute it controls lives in
 * the root layout, so the change is only visible after a reload. Waiting a
 * fixed 300ms was not enough for that round-trip and made this read as a bug
 * in the app — reload until the effect lands instead of sleeping and hoping.
 */
async function selectTheme(page: Page, label: string, expected: string | null) {
  await themeForm(page).getByText(label, { exact: true }).click();
  await expect(async () => {
    await page.reload();
    const attribute = await page.locator("html").getAttribute("data-theme");
    expect(attribute).toBe(expected);
  }).toPass({ timeout: 15_000 });
}

test("Selecting a theme applies it immediately, with no separate Save step", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/account");

  // Start from a known state: an earlier run (or an earlier failure) can leave
  // this user on Night Mode, and "switching to Night" proves nothing then.
  await selectTheme(page, "Platform Default", null);
  await selectTheme(page, "Night Mode", "dark");
  // Switching back must REMOVE the attribute, not just set a different value.
  await selectTheme(page, "Platform Default", null);
});

test("Creative User Type Theme is no longer offered", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/account");
  await expect(page.getByText("Creative User Type Theme")).not.toBeVisible();
});
