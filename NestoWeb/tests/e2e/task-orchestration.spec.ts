import { test, expect as baseExpect, type Page, type Locator } from "@playwright/test";

import { signIn, setEnglishLocale } from "./helpers";

// Every assertion in this file waits on a re-render of the orchestrated task
// view, which the server action performs as part of its response. Configured
// once here rather than annotating thirty individual assertions — see the
// timeout note on describe.configure below for why it is slow.
const expect = baseExpect.configure({ timeout: 20_000 });


// Drives the PRD_4 §15 facade-repair reference workflow end-to-end through
// real logins for every role involved, verifying the acceptance criteria in
// §18.1/§18.2 along the way. Serial: each step depends on state the previous
// step created (a real multi-department case, not independent tests).
// Raised for this file only, not globally. Each step signs in, loads the
// orchestrated task view and performs an action that re-renders it. Against a
// remote database (~138ms per round-trip from a development machine, ~1ms
// co-located in production) that adds up past the 30s default even after
// getTaskOrchestration was changed to fetch its relations in one query
// instead of sixteen.
test.describe.configure({ mode: "serial", timeout: 120_000 });

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await setEnglishLocale(page);
  await signIn(page, username);
}

// Radix Tabs.Content elements pick up an accessible name from their trigger
// (e.g. "Departments"), which makes bare getByLabel("Department") ambiguous
// via substring matching. Every dialog form field lookup below is scoped to
// the open dialog to sidestep that.
function dialog(page: Page): Locator {
  return page.getByRole("dialog");
}

let taskUrl = "";

// Stamped, not hardcoded. A fixed title left one more task behind on every
// run — eight of them by the time this was looked at — and then every locator
// for it became a strict-mode violation. The desktop and mobile projects run
// this file concurrently against the same database too, so they need distinct
// rows regardless.
const taskTitle = `Facade Repair Required — E2E ${Date.now().toString(36)}`;

test("PM creates the task and starts orchestration", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New Task" }).click();
  await dialog(page).getByLabel("Project").selectOption({ label: "Skyline Apartments" });
  await dialog(page).getByLabel("Title").fill(taskTitle);
  await dialog(page).getByLabel("Priority").selectOption("HIGH");
  await dialog(page).getByRole("button", { name: "Create" }).click();
  const taskLink = page.getByRole("link", { name: taskTitle });
  await expect(taskLink).toBeVisible();

  await taskLink.click();
  await page.waitForURL(/\/tasks\/[a-z0-9]+$/);
  taskUrl = page.url();

  await expect(page.getByText("isn't under cross-department orchestration yet")).toBeVisible();
  await page.getByLabel("Task Manager").selectOption({ label: "Pm" });
  await page.getByRole("button", { name: "Start Orchestration" }).click();
  await expect(page.getByText("Current Stage: PM Triage")).toBeVisible();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
});

test("PM activates Engineering and Engineer submits the assessment", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto(taskUrl);

  await page.getByRole("tab", { name: "Workflow" }).click();
  await page.locator("select").selectOption({ label: "Engineering Assessment" });
  await page.getByRole("button", { name: "Advance" }).click();
  await expect(page.getByText("Engineering Assessment").first()).toBeVisible();

  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Activate Department" }).click();
  await dialog(page).getByLabel("Department").selectOption({ label: "Engineering Department" });
  await dialog(page).getByLabel("Accountable Owner").selectOption({ label: "Engineer" });
  await dialog(page).getByLabel("Required Action").fill("Technical assessment and repair recommendation");
  await dialog(page).getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Technical assessment and repair recommendation").first()).toBeVisible();

  await loginAs(page, "Engineer");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("SUBMITTED")).toBeVisible();
});

test("PM approves engineering, advances to Procurement, Procurement submits", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "APPROVE", exact: true }).click();
  await expect(page.getByText("APPROVED").first()).toBeVisible();

  await page.getByRole("tab", { name: "Workflow" }).click();
  await page.locator("select").selectOption({ label: "Repair Confirmed" });
  await page.getByRole("button", { name: "Advance" }).click();
  await page.locator("select").selectOption({ label: "Procurement Assessment" });
  await page.getByRole("button", { name: "Advance" }).click();
  await expect(page.getByText("WAITING FOR PROCUREMENT")).toBeVisible();

  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Activate Department" }).click();
  await dialog(page).getByLabel("Department").selectOption({ label: "Procurement Department" });
  await dialog(page).getByLabel("Accountable Owner").selectOption({ label: "Procurement" });
  await dialog(page).getByLabel("Required Action").fill("Confirm external facade contractor required");
  await dialog(page).getByRole("button", { name: "Create" }).click();

  await loginAs(page, "Procurement");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("SUBMITTED")).toBeVisible();
});

test("PM approves procurement, advances to Legal, Legal records decision", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "APPROVE", exact: true }).click();

  await page.getByRole("tab", { name: "Workflow" }).click();
  await page.locator("select").selectOption({ label: "Legal Assessment" });
  await page.getByRole("button", { name: "Advance" }).click();
  await expect(page.getByText("WAITING FOR CONTRACT")).toBeVisible();

  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Activate Department" }).click();
  await dialog(page).getByLabel("Department").selectOption({ label: "Legal Department" });
  await dialog(page).getByLabel("Accountable Owner").selectOption({ label: "Legal" });
  await dialog(page).getByLabel("Required Action").fill("Confirm contract coverage for facade repair");
  await dialog(page).getByRole("button", { name: "Create" }).click();

  await loginAs(page, "Legal");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Contracts & Procurement" }).click();
  await page.getByRole("button", { name: "Legal Decision" }).click();
  await dialog(page).getByLabel("Decision").selectOption({ label: "NOT REQUIRED" });
  await dialog(page).getByLabel("Reason").fill("Covered under existing general maintenance scope — no new contract needed.");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("NOT REQUIRED")).toBeVisible();

  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("SUBMITTED")).toBeVisible();
});

test("PM approves legal, advances to Contractor Assignment, Procurement assigns contractor", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Departments" }).click();
  await page.getByRole("button", { name: "APPROVE", exact: true }).click();

  await page.getByRole("tab", { name: "Workflow" }).click();
  await page.locator("select").selectOption({ label: "Contractor Assignment" });
  await page.getByRole("button", { name: "Advance" }).click();
  await expect(page.getByText("WAITING FOR CONTRACTOR")).toBeVisible();

  await loginAs(page, "Procurement");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Contracts & Procurement" }).click();
  await page.getByRole("button", { name: "Assign Contractor" }).click();
  await dialog(page).getByLabel("Contractors").selectOption({ label: "Elektro Al Shpk — Electrical" });
  await dialog(page).getByLabel("Scope of Work").fill("Repair East Facade cladding, Levels 3-5");
  await dialog(page).getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Repair East Facade cladding")).toBeVisible();
  await expect(page.getByText("ASSIGNED")).toBeVisible();
});

test("Contractor accepts, starts, and reports ready for inspection", async ({ page }) => {
  await loginAs(page, "Contractor");
  await page.goto("/dashboard/contractor");
  await expect(page.getByText("Repair East Facade cladding")).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("ACCEPTED")).toBeVisible();

  await page.getByRole("button", { name: "Confirm Start" }).click();
  await expect(page.getByText("IN PROGRESS")).toBeVisible();

  await loginAs(page, "Pm");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Workflow" }).click();
  await page.locator("select").selectOption({ label: "Site Execution" });
  await page.getByRole("button", { name: "Advance" }).click();
  await expect(page.getByText("IN EXECUTION")).toBeVisible();

  await loginAs(page, "Contractor");
  await page.goto("/dashboard/contractor");
  await page.getByRole("button", { name: "Ready for Inspection" }).click();
  await expect(page.getByText("READY FOR INSPECTION")).toBeVisible();
});

test("QAQC inspects, PM completes the task, export renders", async ({ page }) => {
  await loginAs(page, "Qaqc");
  await page.goto(taskUrl);
  await page.getByRole("tab", { name: "Inspections" }).click();
  await page.getByRole("button", { name: "Record Inspection" }).first().click();
  await dialog(page).getByLabel("Result").selectOption({ label: "PASSED" });
  await dialog(page).getByLabel("Notes").fill("Facade repair meets specification. No defects observed.");
  await dialog(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("PASSED").first()).toBeVisible();
  await expect(page.getByText("UNDER FINAL VERIFICATION")).toBeVisible();

  await loginAs(page, "Pm");
  await page.goto(taskUrl);
  await expect(page.getByText("Outstanding gates")).not.toBeVisible();
  await page.getByRole("button", { name: "Complete Task" }).first().click();
  await dialog(page).getByLabel("Completion Comment").fill("Facade repair verified complete — all approvals and inspection passed.");
  await dialog(page).getByRole("button", { name: "Complete Task" }).click();
  await expect(page.getByText("COMPLETED").first()).toBeVisible();

  // Export renders as a real page (browser Print > Save as PDF from here).
  await page.goto(`${taskUrl}/export`);
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await expect(page.getByText("Approval Record")).toBeVisible();

  // CEO/executive overview lists the completed case with no open blocker.
  await page.goto("/tasks/orchestration");
  await expect(page.getByText(taskTitle)).toBeVisible();
});
