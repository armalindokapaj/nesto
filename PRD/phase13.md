# Construction OS (Nesto) â PRD: Phase 13, Real Email Verification for Public Accounts v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 2 (`src/lib/email.ts` / Resend integration) â this phase exists specifically because that dependency now exists and the reason this gap was acceptable before no longer holds.
**Scope:** `src/server/public-signup.ts` and its one calling action file â no new business modules.

---

## 0. What I found

This one is unusual in the review series so far: the codebase's own comment names the exact shortcut and why it was taken.

```ts
// No email provider is wired anywhere in this app (established precedent â
// see landing page's Forgot Password flow). The verification link is
// surfaced directly in the UI after registration/resend rather than emailed.
export async function resendVerificationToken(publicAccountId: string) { ... }
```

That was a reasonable, honest tradeoff at the time it was written â there was no email infrastructure, and shipping a functioning application flow without one is a legitimate scope call. **Phase 2 removed the reason.** `src/lib/email.ts` and a working Resend integration exist now specifically to let events like this reach a real inbox. This shortcut wasn't revisited after that landed, so it's now doing something it was never meant to: **"email verification" that doesn't require access to the email account at all.**

```ts
// src/app/actions/public-signup.ts
const { account, verificationToken } = await registerPublicAccount({ ...parsed.data, /* ... */ });
await createPublicSession(account.id);
return { success: true, token: verificationToken }; // <- the real token, back to the browser that just submitted the form
```

Anyone registering an account can put *any* email address in the form â their own, a colleague's, a competitor's, a made-up address at a real company's domain â and the verification token needed to mark that email `emailVerified: true` is handed straight back to whoever is sitting at the keyboard, with zero requirement that they ever received anything at that address. `resendVerificationTokenAction` does the identical thing on every resend.

**What this actually gates, so the severity is stated accurately rather than assumed:** `PublicAccount` registrations feed into a real human review step (`submitApplication()` â `listApplications()` â `recordReview()`, Platform Admin review) before an account is `APPROVED` â this isn't a direct, unreviewed path into the tenant systems the rest of this review has focused on. That matters, and it's worth saying plainly: this isn't as severe as Phase 8's dashboard exposure or Phase 9's stale-session gap. But a Platform Admin reviewing an application almost certainly treats "email verified" as a trust signal â and right now that signal is trivially fake. For a platform vetting contractors and professionals by identity and credentials, a meaningless verification checkmark on exactly the field meant to establish "this person really is who they claim to be" is a real integrity problem, not a cosmetic one.

---

## 1. The fix

### 1.1 Send the token by email; stop returning it to the client

```ts
// src/server/public-signup.ts
import { sendEmail } from "@/lib/email"; // from Phase 2

export async function registerPublicAccount(input: { /* ...unchanged... */ }) {
  // ...unchanged existing validation + account/profile/token creation...

  return db.$transaction(async (tx) => {
    // ...unchanged account/profile/emailVerificationToken/audit-event creation...
    return { account }; // token no longer returned to the caller
  });
}

// Sending the email is a separate step outside the transaction â an email
// provider call has no business holding a database transaction open, and a
// send failure here shouldn't roll back a successfully created account
// (the resend flow below is exactly the recovery path for that case).
export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/apply/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your email â Nesto",
    html: `<p>Confirm your email address to continue your application.</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}
```

```ts
// src/app/actions/public-signup.ts
const { account } = await registerPublicAccount({ ...parsed.data, /* ... */ });
await sendVerificationEmail(parsed.data.email, /* the token â see 1.2 on how it's threaded through */);
await createPublicSession(account.id);
return { success: true }; // no token in the response anymore
```

### 1.2 One structural note: `registerPublicAccount()` currently returns the token as part of its normal return value, which the action then forwarded directly to the client

Rather than changing `registerPublicAccount()`'s signature to accept a callback or awkwardly split "create" from "get me the token," the simplest change is exactly what Â§1.1 shows: keep the token generation inside `registerPublicAccount()` (nothing about the DB-write logic needs to change), but change what the function *returns* â drop `verificationToken` from the returned object, and have `registerPublicAccount()` itself call `sendVerificationEmail()` before returning, inside the same function, right after the transaction commits. That keeps this a one-function, one-file change rather than restructuring the caller.

```ts
export async function registerPublicAccount(input: { /* ... */ }) {
  // ...unchanged validation...
  const result = await db.$transaction(async (tx) => { /* ...unchanged... */ return { account, verificationToken: token }; });
  await sendVerificationEmail(input.email, result.verificationToken);
  return { account: result.account }; // token stops here, never reaches the action layer
}
```

### 1.3 Apply the identical fix to `resendVerificationToken()`

```ts
export async function resendVerificationToken(publicAccountId: string) {
  const account = await db.publicAccount.findUnique({ where: { id: publicAccountId } });
  if (!account) throw new Error("Account not found.");
  const token = crypto.randomBytes(32).toString("hex");
  await db.emailVerificationToken.updateMany({ where: { publicAccountId, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.emailVerificationToken.create({ data: { publicAccountId, token, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) } });
  await sendVerificationEmail(account.email, token);
  // no return value needed anymore â the action just reports success
}
```

### 1.4 Update the client-facing copy

Whatever page renders after registration currently presumably shows the token or a link built from it directly. That UI needs to change to a plain "Check your email to verify your account" message â this is a real UX regression from the applicant's point of view (an extra step, dependent on email deliverability) in exchange for the verification actually meaning something. Worth a short, explicit note in the UI about checking spam folders, since this is the account's very first email from the platform and spam filters are least forgiving of first contact.

### 1.5 One more thing worth closing while in this exact area: unauthenticated request volume

`registerPublicAccount()` and `resendVerificationToken()` are both reachable by anyone, unauthenticated, and now each triggers a real outbound email. Without a rate limit, either endpoint can be used to email-bomb an arbitrary address (repeatedly "registering" or "resending" against someone else's email) or to run up Resend's usage. Reuse Phase 3's `LoginAttempt`-style approach rather than inventing a new mechanism: a simple per-identifier (here, per-email) count-and-window check before sending, using the same Postgres-table pattern already established for login attempts.

### 1.6 Acceptance criteria
- [ ] No API response or Server Action return value contains a raw verification token anywhere in the public-signup flow.
- [ ] Registering and resending both trigger a real email via Resend to the address on file.
- [ ] A registration using an email the requester doesn't control cannot be verified â confirmed by testing that the token never appears anywhere the requester's own browser session can read it.
- [ ] A basic rate limit prevents repeated verification-email sends to the same address in a short window.
- [ ] The `/apply/verify` page and post-registration UI copy reflect "check your email," not a token/link shown inline.

---

## 2. Checked, not just flagged: there is no password-reset flow for `PublicAccount` at all

`authenticatePublicAccount()` exists; a corresponding reset/forgot-password path does not â no matches anywhere in `public-signup.ts` or its action file. This isn't this phase's bug to fix (there's no broken email shortcut to correct, because the feature was never built), but it is a real gap: an applicant who forgets their password today has no self-service way back into an in-progress or already-submitted application. Worth flagging as a real product gap for a future phase, distinct from â and not to be confused with â the fix in this one.

## 3. Sequencing

Single file, single dependent action file. Ship `sendVerificationEmail()` first (small, testable in isolation against a real Resend send), then wire both `registerPublicAccount()` and `resendVerificationToken()` to it together, then the rate limit, then the UI copy update last (since it depends on the action's return shape actually changing first).

## 4. Definition of Done for Phase 13

- [ ] Email verification for public accounts requires actual access to the claimed email address.
- [ ] No verification token is ever returned to the client that requested it.
- [ ] A rate limit protects both the registration and resend endpoints from being used to spam arbitrary addresses.
- [ ] Zero new business features shipped during this phase.

## 5. What comes next (not in scope here)

A password-reset flow for `PublicAccount` â confirmed absent in Â§2, and a real product gap rather than a security bug, since there's simply no path today for an applicant who forgets their password. Worth its own phase, built using the same `sendVerificationEmail()`-style pattern this phase establishes rather than reopening the "no email provider" shortcut a second time. Separately: the tenant-side `requestPasswordResetAction()` (Phase 3 territory) was built deliberately without a reset-link email at all â by design, since accounts there are admin-provisioned and the flow notifies the workspace admin instead of the requester. That's a different, already-considered tradeoff, not the same bug â worth being clear this phase doesn't suggest changing that one.
