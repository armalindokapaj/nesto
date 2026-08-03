import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "nesto_locale", value: "en", domain: "localhost", path: "/" }]);
  await page.goto("/");
  await page.getByPlaceholder(/you@company.com or username/i).fill(username);
  await page.getByPlaceholder(/enter your password/i).fill("1");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test("Finance user opening Clients keeps the Finance sidebar, not Executive/Sales", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Budget vs Actual" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payments" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Company", exact: true })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Administration" })).not.toBeVisible();
});

test("HR user opening Projects keeps the HR sidebar", async ({ page }) => {
  await loginAs(page, "Hr");
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: "Employees" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recruitment" })).toBeVisible();
});

test("Architect user opening Clients keeps the Architecture sidebar", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto("/clients");
  await expect(page.getByRole("link", { name: "Drawings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "RFIs" })).toBeVisible();
});

test("Procurement user opening Projects keeps the Procurement sidebar", async ({ page }) => {
  await loginAs(page, "Procurement");
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: "Suppliers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Purchase Orders" })).toBeVisible();
});

test("Admin user opening Tasks keeps the Admin sidebar", async ({ page }) => {
  await loginAs(page, "Admin");
  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Roles & Permissions" })).toBeVisible();
});

test("PM (executive-home role) opening Clients still sees the Executive sidebar", async ({ page }) => {
  await loginAs(page, "Pm");
  await page.goto("/clients");
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Finance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Task Orchestration" })).toBeVisible();
});

test("Finance user still sees the Finance dashboard shell when browsing its own subtree", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/dashboard/finance/invoices");
  await expect(page.getByRole("link", { name: "Budget vs Actual" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payments" })).toBeVisible();
});

test("Sales user opening the Finance dashboard keeps the Sales/Executive sidebar, not the full Finance console", async ({ page }) => {
  await loginAs(page, "Sales");
  await page.goto("/dashboard/finance");
  await expect(page.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Budget vs Actual" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Tax Management" })).not.toBeVisible();
});

test("Legal user opening the Finance dashboard keeps its own sidebar", async ({ page }) => {
  await loginAs(page, "Legal");
  await page.goto("/dashboard/finance");
  await expect(page.getByRole("link", { name: "Contracts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Budget vs Actual" })).not.toBeVisible();
});

test("Finance user opening the Procurement dashboard keeps the Finance sidebar, not the full Procurement console", async ({ page }) => {
  await loginAs(page, "Finance");
  await page.goto("/dashboard/procurement");
  const sidebar = page.locator("nav");
  await expect(sidebar.getByRole("link", { name: "Invoices" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Suppliers" })).not.toBeVisible();
});

test("Owner opening the Finance dashboard still gets the real Finance console (legitimate FULL access)", async ({ page }) => {
  await loginAs(page, "Owner");
  await page.goto("/dashboard/finance");
  await expect(page.getByRole("link", { name: "Budget vs Actual" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tax Management" })).toBeVisible();
});
