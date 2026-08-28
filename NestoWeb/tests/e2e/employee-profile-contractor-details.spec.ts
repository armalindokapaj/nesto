import { test, expect, type Page } from "@playwright/test";
import { signIn, setEnglishLocale } from "./helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);

async function loginAs(page: Page, username: string, password = "1") {
  await page.context().clearCookies();
  await setEnglishLocale(page);
  await signIn(page, username, password);
}

let arbenProfileUrl = "";

test("Any company member can open the company-wide Employee Directory and a colleague's profile", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto("/employees");
  await expect(page.getByRole("heading", { name: "Employee Directory" })).toBeVisible();
  await page.getByText("Arben Kola").click();
  await page.waitForURL(/\/employees\//);
  arbenProfileUrl = page.url();
  await expect(page.getByRole("heading", { name: "Arben Kola" })).toBeVisible();
});

test("An uninvolved colleague sees CV/certifications but not the work contract section or edit controls", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto(arbenProfileUrl);
  await expect(page.getByRole("heading", { name: "CV & Certifications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Work Contract" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Change Photo" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Add Document" })).not.toBeVisible();
});

test("The profile owner can upload a CV/certification and it becomes visible to a colleague", async ({ page }) => {
  await loginAs(page, "arben.kola", "1");
  await page.goto(arbenProfileUrl);
  await expect(page.getByRole("button", { name: "Change Photo" })).toBeVisible();

  const cvName = `CV ${stamp}.pdf`;
  // Page order is CV & Certifications, then Work Contract — the CV card's
  // Add Document button is the first of the two (Owner also has HR:FULL, so
  // both cards render one).
  await page.getByRole("button", { name: "Add Document" }).first().click();
  await page.getByLabel("Category").selectOption("CV");
  await page.getByLabel("Document name").fill(cvName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(cvName)).toBeVisible();

  // Owner can also see the Work Contract section itself (not just CV/Certifications).
  await expect(page.getByRole("heading", { name: "Work Contract" })).toBeVisible();

  await loginAs(page, "Architect");
  await page.goto(arbenProfileUrl);
  await expect(page.getByText(cvName)).toBeVisible();
});

test("Only HR can attach a work contract, and it stays hidden from an uninvolved colleague", async ({ page }) => {
  await loginAs(page, "ana.krasniqi", "1");
  await page.goto(arbenProfileUrl);
  await expect(page.getByRole("heading", { name: "Work Contract" })).toBeVisible();

  const contractName = `Employment Agreement ${stamp}.pdf`;
  // HR also has HR:FULL on the general CV/Certifications card, so there are
  // two "Add Document" buttons — the Work Contract card's is the second.
  await page.getByRole("button", { name: "Add Document" }).last().click();
  await expect(page.getByLabel("Category")).toHaveValue("WORK_CONTRACT");
  await page.getByLabel("Document name").fill(contractName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(contractName)).toBeVisible();

  // The owner can see their own contract.
  await loginAs(page, "arben.kola", "1");
  await page.goto(arbenProfileUrl);
  await expect(page.getByText(contractName)).toBeVisible();

  // An uninvolved colleague never sees the section at all.
  await loginAs(page, "Architect");
  await page.goto(arbenProfileUrl);
  await expect(page.getByRole("heading", { name: "Work Contract" })).not.toBeVisible();
  await expect(page.getByText(contractName)).not.toBeVisible();
});

test("A role with COMPANY_NETWORK write access can set a contractor's Tax ID and Bank Account", async ({ page }) => {
  await loginAs(page, "Legal");
  await page.goto("/contractors");
  await page.getByText("Elektro Al Shpk").click();
  await page.waitForURL(/\/contractors\//);

  await page.getByLabel("Tax ID (NIPT)").fill("L12345678A");
  await page.getByLabel("Bank Account Number").fill("AL47212110090000000235698741");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Save ✓")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Tax ID (NIPT)")).toHaveValue("L12345678A");
});

test("A read-only role sees the contractor's Tax ID and Bank Account without an edit form", async ({ page }) => {
  await loginAs(page, "Architect");
  await page.goto("/contractors");
  await page.getByText("Elektro Al Shpk").click();
  await page.waitForURL(/\/contractors\//);

  await expect(page.getByText("L12345678A")).toBeVisible();
  await expect(page.getByLabel("Tax ID (NIPT)")).not.toBeVisible();
});
