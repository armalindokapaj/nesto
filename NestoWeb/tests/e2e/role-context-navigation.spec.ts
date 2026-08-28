import { test, expect, type Page } from "@playwright/test";
import { signIn, setEnglishLocale } from "./helpers";

// These assert that the shell resolves from the signed-in user's ROLE, not
// from the path they happen to be on. The links checked are ones only that
// role's console carries — "Payments", for instance, is no good as a Finance
// marker because the Sales sidebar has one too.
//
// Scoped to the workspace sidebar rather than any <nav>: each page also renders
// its own section nav, so an unscoped locator sees links the sidebar does not
// have and the negative assertions silently pass or fail for the wrong reason.
function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Workspace" });
}

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await setEnglishLocale(page);
  await signIn(page, username, "1");
}

test("Finance user opening Clients keeps the Finance sidebar, not Executive/Sales", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Chart of Accounts" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "General Ledger" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Company", exact: true })).not.toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Administration" })).not.toBeVisible();
});

test("HR user opening Projects keeps the HR sidebar", async ({ page }) => {
  await loginAs(page, "Hr");
  await page.goto("/projects");
  await expect(sidebar(page).getByRole("link", { name: "Employees" })).toBeVisible();
  // The HR nav rework split "Recruitment" into its constituent screens.
  await expect(sidebar(page).getByRole("link", { name: "Vacancies" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Candidates" })).toBeVisible();
});

test("Architect user opening Clients keeps the Architecture sidebar", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto("/clients");
  await expect(sidebar(page).getByRole("link", { name: "Drawings" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "RFIs" })).toBeVisible();
});

test("Procurement user opening Projects keeps the Procurement sidebar", async ({ page }) => {
  await loginAs(page, "Procurement");
  await page.goto("/projects");
  await expect(sidebar(page).getByRole("link", { name: "Supplier Directory" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Purchase Orders" })).toBeVisible();
});

test("Admin user opening Tasks keeps the Admin sidebar", async ({ page }) => {
  await loginAs(page, "Admin");
  await page.goto("/tasks");
  await expect(sidebar(page).getByRole("link", { name: "Users" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Roles & Permissions" })).toBeVisible();
});

test("PM (executive-home role) opening Clients still sees the Executive sidebar", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Finance", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Task Orchestration" })).toBeVisible();
});

test("Finance user still sees the Finance dashboard shell when browsing its own subtree", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/dashboard/finance/invoices");
  await expect(sidebar(page).getByRole("link", { name: "Chart of Accounts" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "General Ledger" })).toBeVisible();
});

test("Sales user opening the Finance dashboard keeps the Sales/Executive sidebar, not the full Finance console", async ({ page }) => {
  await loginAs(page, "Sales");
  await page.goto("/dashboard/finance");
  await expect(sidebar(page).getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Chart of Accounts" })).not.toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Tax Management" })).not.toBeVisible();
});

test("Legal user opening the Finance dashboard keeps its own sidebar", async ({ page }) => {
  await loginAs(page, "Legal");
  await page.goto("/dashboard/finance");
  await expect(sidebar(page).getByRole("link", { name: "Contracts" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Chart of Accounts" })).not.toBeVisible();
});

test("Finance user opening the Procurement dashboard keeps the Finance sidebar, not the full Procurement console", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/dashboard/procurement");
  await expect(sidebar(page).getByRole("link", { name: "Invoices" })).toBeVisible();
  // The Procurement page renders its own section nav containing "Suppliers";
  // what matters is that the SIDEBAR is still Finance's.
  await expect(sidebar(page).getByRole("link", { name: "Supplier Directory" })).not.toBeVisible();
});

test("Owner opening the Finance dashboard still gets the real Finance console (legitimate FULL access)", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/dashboard/finance");
  await expect(sidebar(page).getByRole("link", { name: "Chart of Accounts" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Tax Management" })).toBeVisible();
});
