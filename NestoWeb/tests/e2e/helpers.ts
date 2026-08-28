import { expect, type Page } from "@playwright/test";

/**
 * One sign-in path for the whole e2e suite.
 *
 * Every spec used to inline these four lines, which is why a single change to
 * the login card could — and did — break thirteen spec files at once. The
 * point of this file is that the next login change is one edit, not thirteen.
 */

export const SEED_PASSWORD = "1";

/**
 * The identifier field opens a demo-role picker on focus, and the picker is
 * absolutely positioned over the password field and the submit button. It has
 * no Escape handler and no click-outside handler, so its only dismissal is its
 * own chevron — which is what this uses.
 *
 * Dismissing through the app's own affordance rather than force-clicking
 * through the overlay: a force-click would pass even if the submit button
 * really were unreachable, and an unreachable submit button is exactly the
 * regression this suite exists to catch.
 */
async function dismissDemoPicker(page: Page) {
  const toggle = page.getByRole("button", { name: /show test user roles/i });
  if ((await toggle.count()) === 0) return;
  // aria-expanded is the picker's own state, so this closes it without
  // assuming it was open.
  if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
}

/** Force English before the first navigation — Albanian is the app default and the specs assert English copy. */
export async function useEnglish(page: Page, baseURL?: string) {
  await page.context().addCookies([
    baseURL
      ? { name: "nesto_locale", value: "en", url: baseURL }
      : { name: "nesto_locale", value: "en", domain: "localhost", path: "/" },
  ]);
}

/**
 * Fill the credentials without submitting — for specs asserting on validation.
 *
 * Located by input name rather than placeholder copy: the placeholder is
 * translated, and the tenant default locale is Albanian, so copy-based
 * locators only work in specs that also force the locale cookie.
 *
 * Both inputs are controlled by React state, so a fill that lands before
 * hydration is silently discarded on the next render and the form submits
 * empty. Retry until the values actually stick.
 */
export async function fillCredentials(page: Page, username: string, password: string = SEED_PASSWORD) {
  const identifier = page.locator('input[name="identifier"]');
  const secret = page.locator('input[name="password"]');
  await identifier.waitFor({ state: "visible" });
  await expect(async () => {
    await identifier.fill(username);
    await secret.fill(password);
    await expect(identifier).toHaveValue(username);
    await expect(secret).toHaveValue(password);
  }).toPass({ timeout: 15_000 });
  await dismissDemoPicker(page);
}

/** Submits by form structure rather than button copy, for the same locale reason. */
export async function submitSignIn(page: Page) {
  await page
    .locator("form")
    .filter({ has: page.locator('input[name="identifier"]') })
    .getByRole("button")
    .last()
    .click();
}

/**
 * Sign in and wait for the post-login redirect to land.
 *
 * Waiting matters: navigating immediately after the click races the server
 * action's redirect and can fire before the session cookie is set, which
 * surfaces as a random bounce back to the login page.
 */
export async function signIn(page: Page, username: string, password: string = SEED_PASSWORD) {
  await page.goto("/");
  await fillCredentials(page, username, password);
  await submitSignIn(page);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}
