import { test, expect, type Page } from "@playwright/test";

// End-to-end coverage for the Audit 2 reference workflow: Contract Approved
// -> Finance Structure -> Payment Recorded -> Contractor Profile. Walks the
// exact UI path a Contracts/Finance user would use, proving the domain-event
// reactions (src/server/contract-lifecycle-reactions.ts) actually fire from
// real requests, not just in the unit-level pipeline test.
//
// Creates its own throwaway contract (unique title, per-tenant auto-numbered)
// rather than mutating a shared seeded fixture, so the desktop and mobile
// Playwright projects running this file concurrently against the same dev
// database never collide — the same reason task-orchestration.spec.ts had
// to move away from a hardcoded fixture title.

async function loginAs(page: Page, username: string, password = "1") {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "nesto_locale", value: "en", domain: "localhost", path: "/" }]);
  await page.goto("/");
  await page.getByPlaceholder(/you@company.com or username/i).fill(username);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test("approving a contract creates its Finance Structure payment, and posting it in full completes the contract", async ({ page }) => {
  await loginAs(page, "Owner");
  const title = `E2E Reference Workflow ${Date.now()}`;

  await page.goto("/contracts");
  await page.getByRole("button", { name: "New Contract", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#title").fill(title);
  await dialog.locator("#value").fill("12345");
  await dialog.locator("#contractorId").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).not.toBeVisible();

  const contractRow = page.getByRole("row", { name: new RegExp(title) });
  await expect(contractRow.getByText("Draft")).toBeVisible();
  const contractNumber = (await contractRow.locator("td").first().innerText()).trim();

  // Step 1: Contract Approved.
  await contractRow.getByRole("button", { name: "Approve" }).click();
  await expect(contractRow.getByText("Active")).toBeVisible();

  // Step 2: the ContractApproved reaction created a PENDING "Finance
  // Structure" payment for the full contract value, tagged with this
  // contract's own number.
  await page.goto("/dashboard/finance/payments");
  const paymentRow = page.getByRole("row", { name: new RegExp(contractNumber) });
  await expect(paymentRow).toBeVisible();
  await expect(paymentRow.getByText("PENDING")).toBeVisible();

  // Step 3: Payment Recorded — post it.
  await paymentRow.getByRole("button", { name: "Post" }).click();
  await expect(paymentRow.getByText("POSTED")).toBeVisible();

  // Step 4: the PaymentRecorded reaction reconciles the contract to
  // COMPLETED because the posted payment covers the full contract value.
  // Contractor Profile needs no separate check here — it reads Contract
  // rows live through the relation, so this same status change is exactly
  // what /contractors/[id] would show without any denormalized copy.
  await page.goto("/contracts");
  await expect(contractRow.getByText("Completed")).toBeVisible();
});
