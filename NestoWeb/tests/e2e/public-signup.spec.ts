import { test, expect, type Page } from "@playwright/test";
import { fillCredentials, submitSignIn } from "./helpers";

// Drives the full PRD_6 loop: public sign-up -> email verification ->
// profile onboarding -> submission -> Platform Admin approval -> the
// applicant sees their approved status and permanent profile number.
test.describe.configure({ mode: "serial" });

const uniqueSuffix = Date.now().toString(36);
const email = `e2e.professional.${uniqueSuffix}@example.com`;
const username = `e2epro${uniqueSuffix}`;

async function setEnglishLocale(page: Page) {
  await page.context().addCookies([{ name: "nesto_locale", value: "en", domain: "localhost", path: "/" }]);
}

test("Visitor registers as a professional and lands on the verify-email step", async ({ page }) => {
  await setEnglishLocale(page);
  await page.goto("/apply");
  await expect(page.getByRole("heading", { name: "Join the Nesto professional network" })).toBeVisible();

  await page.getByText("Continue as Professional").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Country").fill("Albania");
  await page.getByLabel("Password", { exact: true }).fill("SuperSecret123");
  await page.getByLabel("Confirm Password").fill("SuperSecret123");
  await page.getByText("I accept the Terms of Service").click();
  await page.getByText("I accept the Privacy Policy").click();
  await page.getByRole("button", { name: "Create Account" }).click();

  // registerAction doesn't redirect itself — the new session cookie makes
  // /apply's own peekPublicSession check route here on the automatic
  // post-action refresh.
  await page.waitForURL(/\/apply\/verify/);
  await expect(page.getByText("Verify your email")).toBeVisible();
});

test("Applicant verifies email and completes the professional profile", async ({ page }) => {
  await setEnglishLocale(page);
  await page.goto("/apply");
  await page.getByText("Already have an account?").isVisible();
  // Sign back in (session cookie is isolated to the prior test's browser
  // context) to reach the verification link again via resend.
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Company Email or Username").fill(username);
  await page.getByLabel("Password").fill("SuperSecret123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/apply\/verify/);

  await page.getByRole("button", { name: "Get a new verification link" }).click();
  const verifyLink = page.getByRole("link", { name: /\/apply\/verify\?token=/ });
  await expect(verifyLink).toBeVisible();
  const href = await verifyLink.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await page.waitForURL(/\/apply\/onboarding/);

  // Step 1: Profile
  await page.getByLabel("First Name").fill("Ada");
  await page.getByLabel("Last Name").fill("Lovelace");
  await page.getByLabel("Professional Title").fill("Structural Engineer");
  await page.getByLabel("Primary Profession").selectOption("STRUCTURAL_ENGINEER");
  await page.getByLabel("Country", { exact: true }).fill("Albania");
  await page.getByLabel("City").fill("Tirana");
  await page.getByLabel("Years of Experience").fill("8");
  await page.getByLabel("Employment Status").selectOption("SELF_EMPLOYED");
  await page.getByLabel("Availability").selectOption("AVAILABLE_NOW");
  await page.getByLabel("Professional Email").fill(email);
  await page.getByLabel("Professional Headline").fill("Structural engineer specializing in seismic retrofits");
  await page.getByLabel("Professional Summary").fill("Eight years designing and reviewing structural systems for mid-rise residential and commercial buildings.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("100% complete")).not.toBeVisible(); // not yet — skills/CV missing

  // Step 2: skip experience/education (optional beyond completeness check)
  await page.getByRole("button", { name: "Skills & Certifications" }).click();
  await page.getByLabel("Skill").fill("Structural Analysis");
  await page.getByRole("button", { name: "Add Skill" }).click();
  await expect(page.getByText("Structural Analysis")).toBeVisible();

  // Step: Documents (CV required for completeness)
  await page.getByRole("button", { name: "Documents" }).click();
  await page.getByLabel("Document Category").selectOption("CV");
  await page.getByLabel("Document name").fill("Ada_Lovelace_CV.pdf");
  await page.getByRole("button", { name: "Add Document" }).click();
  await expect(page.getByText("Ada_Lovelace_CV.pdf")).toBeVisible();

  // Step: Review & Submit
  await page.getByRole("button", { name: "Review & Submit" }).click();
  await expect(page.getByText("Your profile is complete and ready to submit.")).toBeVisible();
  await page.getByText("I confirm this information is accurate").click();
  await page.getByRole("button", { name: "Submit for Review" }).click();
  await page.waitForURL(/\/apply\/pending/);
  await expect(page.getByText("Pending Review")).toBeVisible();
});

test("Platform Admin approves the application", async ({ page }) => {
  await setEnglishLocale(page);
  await page.goto("/");
  await fillCredentials(page, "Owner");
  await submitSignIn(page);
  await page.waitForURL(/\/dashboard/);

  await page.goto("/platform/applications");
  await expect(page.getByRole("heading", { name: "Platform Applications" })).toBeVisible();
  await page.locator("tr", { hasText: email }).getByText("Ada Lovelace").click();
  await page.waitForURL(/\/platform\/applications\//);

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm Decision" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
});

test("Applicant sees the approved status and permanent profile number", async ({ page }) => {
  await setEnglishLocale(page);
  await page.goto("/apply");
  await page.getByText("Already have an account?").isVisible();
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Company Email or Username").fill(username);
  await page.getByLabel("Password").fill("SuperSecret123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/apply\/pending/);

  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Profile Number: PRO-/)).toBeVisible();
});
