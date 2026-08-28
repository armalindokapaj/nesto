import { test, expect, type Page } from "@playwright/test";
import { signIn, verificationTokenFor } from "./helpers";

// PRD_6 end-to-end: public sign-up -> multi-step onboarding -> submission ->
// Platform Admin review -> approval -> the applicant sees the outcome.
// Steps 1-3 share one continuous public-session cookie so they run inside a
// single test (Playwright gives each `test()` its own fresh page/context —
// splitting further would lose that cookie). The Platform Admin steps are
// separate tests that establish their own fresh login, same pattern as the
// other multi-role suites in this repo.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const email = `applicant.${stamp}@example.com`;
const username = `applicant${stamp}`;
const password = "Password123!";

test("visitor registers, verifies email, completes onboarding and submits", async ({ page }: { page: Page }) => {
  await page.goto("/apply");
  await expect(page.getByRole("heading", { name: "Bashkohuni me rrjetin profesional të Nesto-s" })).toBeVisible();

  await page.getByText("Vazhdo si Profesionist").click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Përdoruesi").fill(username);
  await page.getByLabel("Fjalëkalimi", { exact: true }).fill(password);
  await page.getByLabel("Konfirmo Fjalëkalimin").fill(password);
  await page.getByText("Pranoj Kushtet e Shërbimit").click();
  await page.getByText("Pranoj Politikën e Privatësisë").click();
  await page.getByRole("button", { name: "Krijo Llogari" }).click();

  await page.waitForURL(/\/apply\/verify$/);
  await expect(page.getByText("Verifikoni email-in tuaj")).toBeVisible();
  // The token is read from the database rather than off the page: a production
  // build never reveals one it may have failed to email. See
  // verificationTokenFor() for why that is the app being right, not a gap.
  await page.getByRole("button", { name: "Merr një lidhje të re verifikimi" }).click();
  await page.goto(`/apply/verify?token=${await verificationTokenFor(email)}`);
  await page.waitForURL(/\/apply\/onboarding/);
  await expect(page.getByRole("heading", { name: "Plotësoni profilin tuaj" })).toBeVisible();

  // Step: Profili
  await page.getByLabel("Emri", { exact: true }).fill("Ana");
  await page.getByLabel("Mbiemri").fill("Berisha");
  await page.getByLabel("Titulli Profesional", { exact: true }).fill("Senior Architect");
  await page.getByLabel("Profesioni Kryesor").selectOption("ARCHITECT");
  await page.getByLabel("Shteti").fill("Albania");
  await page.getByLabel("Qyteti").fill("Tirana");
  await page.getByLabel("Vite Përvojë").fill("8");
  await page.getByLabel("Statusi i Punësimit").selectOption("SELF_EMPLOYED");
  await page.getByLabel("Disponueshmëria").selectOption("AVAILABLE_NOW");
  await page.getByLabel("Email Profesional").fill(`pro.${stamp}@example.com`);
  await page.getByLabel("Titulli Profesional i Shkurtër").fill("Facade & residential design specialist");
  await page.getByLabel("Përmbledhja Profesionale").fill("Eight years designing residential and mixed-use buildings across the Balkans.");
  await page.getByRole("button", { name: "Ruaj" }).click();
  await expect(page.getByLabel("Emri", { exact: true })).toHaveValue("Ana");
  await page.reload();
  await expect(page.getByLabel("Emri", { exact: true })).toHaveValue("Ana");

  // Step: Përvoja & Arsimi
  await page.getByText("Përvoja & Arsimi").click();
  const experienceForm = page.locator("form").filter({ hasText: "Punëdhënësi" });
  await experienceForm.getByLabel("Punëdhënësi / Klienti").fill("Studio Berisha");
  await experienceForm.getByLabel("Pozicioni").fill("Lead Architect");
  await experienceForm.getByLabel("Data e Fillimit").fill("2018-01-01");
  await experienceForm.getByLabel("Përshkrimi").fill("Led design on 12 residential projects.");
  await page.getByRole("button", { name: "Shto Përvojë" }).click();
  await expect(page.getByText("Lead Architect — Studio Berisha")).toBeVisible();

  // Step: Aftësitë & Certifikimet
  await page.getByText("Aftësitë & Certifikimet").click();
  await page.getByLabel("Aftësia").fill("Revit");
  await page.getByRole("button", { name: "Shto Aftësi" }).click();
  await expect(page.getByText("Revit")).toBeVisible();

  // Step: Dokumentet
  await page.getByText("Dokumentet", { exact: true }).click();
  await page.getByLabel("Emri i dokumentit").fill("Ana_Berisha_CV.pdf");
  await page.getByRole("button", { name: "Shto Dokument" }).click();
  await expect(page.getByText("Ana_Berisha_CV.pdf")).toBeVisible();

  // Step: Rishiko & Dërgo
  await page.getByText("Rishiko & Dërgo").click();
  await expect(page.getByText("Profili juaj është i plotë dhe gati për t'u dërguar.")).toBeVisible();
  await page.getByText("Konfirmoj që kjo informacion është i saktë").click();
  await page.getByRole("button", { name: "Dërgo për Shqyrtim" }).click();

  await page.waitForURL(/\/apply\/pending/);
  await expect(page.getByText("Në Pritje të Shqyrtimit", { exact: true })).toBeVisible();
});

test("Platform Admin sees the application, opens it and approves it", async ({ page }: { page: Page }) => {
  // The platform console gates on UserIdentity.isPlatformAdmin, which the
  // per-role test accounts do not carry — "Owner" is a tenant role, not a
  // platform one. This spec runs in Albanian on purpose (the tenant default),
  // but the sign-in itself goes through the shared helper.
  await signIn(page, "PlatformAdmin");

  await page.goto("/platform/applications");
  await expect(page.getByRole("heading", { name: "Aplikimet e Platformës" })).toBeVisible();
  await page.locator("tr", { hasText: email }).getByText("Ana Berisha").click();
  await page.waitForURL(/\/platform\/applications\//);
  await expect(page.getByRole("heading", { name: "Ana Berisha" })).toBeVisible();

  await page.getByRole("button", { name: "Mirato", exact: true }).click();
  await page.getByRole("button", { name: "Konfirmo Vendimin" }).click();
  await expect(page.getByText("Miratuar", { exact: true }).first()).toBeVisible();
});

test("the applicant signs back in and sees the approved status and a permanent profile number", async ({ page }: { page: Page }) => {
  await page.goto("/apply");
  await page.getByRole("button", { name: "Kyçu", exact: true }).click();
  await page.getByLabel("Email-i i Kompanisë ose Përdoruesi").fill(username);
  await page.getByLabel("Fjalëkalimi").fill(password);
  await page.getByRole("button", { name: "Kyçu", exact: true }).click();

  await page.waitForURL(/\/apply\/pending/);
  await expect(page.getByText("Miratuar", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/PRO-\d+/)).toBeVisible();
});
