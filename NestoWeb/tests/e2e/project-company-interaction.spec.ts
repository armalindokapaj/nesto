import { test, expect, type Page } from "@playwright/test";
import { signIn, setEnglishLocale } from "./helpers";

// Drives PRD_10's core contract: every project is company-wide discoverable,
// but task visibility, Finance figures, and deep links still obey their own
// permissions independently of the shell being open to everyone.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const projectName = `PRD10 Interaction Test ${stamp}`;
const publicTaskTitle = `Public task ${stamp}`;
const privateTaskTitle = `Private task ${stamp}`;
const deptTaskTitle = `Finance-only task ${stamp}`;

let projectUrl = "";
let privateTaskUrl = "";

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await setEnglishLocale(page);
  await signIn(page, username, "1");
}

test("Owner creates a project with a budget and three tasks of different visibility", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Budget (EUR)").fill("500000");
  await page.getByRole("button", { name: "Create" }).click();
  // By role, not by text: the project name also appears in the card subtitle,
  // so a bare text locator is a strict-mode violation.
  const projectLink = page.getByRole("link", { name: projectName }).first();
  await expect(projectLink).toBeVisible();

  await projectLink.click();
  await page.waitForURL(/\/projects\//);
  projectUrl = page.url();

  // COMPANY_PUBLIC (default) task.
  await page.getByRole("button", { name: "New Task" }).click();
  await page.getByLabel("Title").fill(publicTaskTitle);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(publicTaskTitle)).toBeVisible();

  // PRIVATE task.
  await page.getByRole("button", { name: "New Task" }).click();
  await page.getByLabel("Title").fill(privateTaskTitle);
  await page.getByLabel("Who can see this task").selectOption("PRIVATE");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(privateTaskTitle)).toBeVisible();
  privateTaskUrl = await page.getByRole("link", { name: privateTaskTitle }).getAttribute("href") as string;

  // DEPARTMENT_PUBLIC (Finance) task.
  await page.getByRole("button", { name: "New Task" }).click();
  await page.getByLabel("Title").fill(deptTaskTitle);
  await page.getByLabel("Who can see this task").selectOption("DEPARTMENT_PUBLIC");
  await page.getByLabel("Department").selectOption("FINANCE");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(deptTaskTitle)).toBeVisible();
});

test("Owner (creator) sees all three tasks and the real budget", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto(projectUrl);
  await expect(page.getByText(publicTaskTitle)).toBeVisible();
  await expect(page.getByText(privateTaskTitle)).toBeVisible();
  await expect(page.getByText(deptTaskTitle)).toBeVisible();
  // Appears twice — as the budget and as the remaining balance, which are
  // equal while nothing has been spent against this project.
  await expect(page.getByText("500.000 €").first()).toBeVisible();
});

test("An uninvolved Architect sees the public task but not the private or Finance-only tasks, and the budget is restricted", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto(projectUrl);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText("Unassigned").first()).toBeVisible();
  await expect(page.getByText(publicTaskTitle)).toBeVisible();
  await expect(page.getByText(privateTaskTitle)).not.toBeVisible();
  await expect(page.getByText(deptTaskTitle)).not.toBeVisible();
  await expect(page.getByText("Restricted").first()).toBeVisible();

  await page.goto("/tasks");
  await expect(page.getByText(publicTaskTitle)).toBeVisible();
  await expect(page.getByText(privateTaskTitle)).not.toBeVisible();
  await expect(page.getByText(deptTaskTitle)).not.toBeVisible();
});

test("A Finance user sees the department-restricted task but still not the private task", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto(projectUrl);
  await expect(page.getByText(deptTaskTitle)).toBeVisible();
  await expect(page.getByText(privateTaskTitle)).not.toBeVisible();
  await expect(page.getByText("500.000 €")).toBeVisible();
});

test("Deep-linking to a private task as an uninvolved user shows a neutral restricted state, not the task", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto(privateTaskUrl);
  await expect(page.getByText("You don't have access to this record.")).toBeVisible();
  await expect(page.getByText(privateTaskTitle)).not.toBeVisible();
});

test("The private task's creator can still open it directly", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto(privateTaskUrl);
  await expect(page.getByText("You don't have access to this record.")).not.toBeVisible();
});

test("Global search never returns the private task or a finance-record count to an uninvolved user", async ({ page }) => {
  await loginAs(page, "Architect");
  const res = await page.request.get(`/api/search?q=${encodeURIComponent(stamp)}`);
  const body = await res.json();
  const titles = body.results.map((r: { title: string }) => r.title);
  expect(titles).not.toContain(privateTaskTitle);
  expect(titles).not.toContain(deptTaskTitle);
});
