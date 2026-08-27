# Construction OS (Nesto) â PRD: Phase 3, Auth Hardening & Security Headers v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 0 (Postgres + CI), Phase 1 (access scoping + audit), Phase 2 (notification delivery)
**Scope:** no new business modules; this phase closes two specific, unprotected surfaces found by tracing the actual auth code paths â no WAF, no new security vendor, no infra.

---

## 0. What I found

The existing auth code is genuinely careful in the ways that are cheap to get right and easy to get wrong: `login()` in `src/app/actions/auth.ts` already does a constant-shape response (hashes against a dummy bcrypt hash when the user doesn't exist, so a timing/response difference can't be used to enumerate accounts), and `requestPasswordResetAction()` follows the same discipline. That's real, deliberate security work already in the codebase â not something this phase needs to touch.

What's missing is the other half of brute-force defense: **nothing limits how many times someone can try.**

| # | Finding | Evidence |
|---|---|---|
| A | **No rate limiting anywhere in the codebase.** `grep` for `rateLimit`/`rate-limit` across the entire source tree returns nothing. `src/proxy.ts` (Next 16's middleware) only does the optimistic session-cookie check â no throttling. Both password-checking functions â `login()` in `auth.ts` and `authenticatePublicAccount()` in `public-signup.ts` (the separate contractor/professional onboarding login) â will call `bcrypt.compare()` as many times as requested, from anywhere, with no lockout, backoff, or logging of repeated failures. |
| B | **No security response headers configured.** `next.config.ts` sets `serverActions.bodySizeLimit` and some vanity redirects, and nothing else. No Content-Security-Policy, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy`. Vercel adds a few sane defaults (HSTS among them) but CSP and clickjacking protection are not on by default and aren't set here. |
| C | **Uploaded file content-type isn't validated against an allowlist.** `project-photos.ts` (and the sibling render/upload actions) correctly caps file size at 8MB and checks `file.size === 0`, but accepts `file.type` as reported by the browser with no allowlist â a file claiming to be `image/jpeg` isn't verified to actually be one. Lower severity than A and B (files are stored in Blob and referenced by URL, not executed), but cheap to close while already in this code.

Findings A and B are the ones I'd actually call blocking for handling real company data â this is a system that will hold payroll, legal case records, and contract values, and right now anyone can point a script at the login form indefinitely.

---

## 1. Track A â Rate limit both login paths

### 1.1 Design decision: Postgres, not a new service

The obvious "correct" answer here is Redis (Upstash's serverless Redis + `@upstash/ratelimit` is the standard pairing for this exact problem on Vercel). I'm deliberately not recommending it. This project already has a database that's provisioned, connected, and under one roof â adding a second data store, a second vendor account, and a second env var for one narrow feature is exactly the kind of complexity this project doesn't need yet. A `LoginAttempt` table with a count query is a few lines, uses infrastructure that already exists, and is more than sufficient at this scale. Revisit only if login volume ever gets high enough that the extra table writes matter, which is a good problem to not have yet.

### 1.2 Schema addition

```prisma
model LoginAttempt {
  id         String   @id @default(cuid())
  identifier String   // the email/username as typed â not tied to a resolved user, since a failed attempt might not match anyone
  ip         String?
  succeeded  Boolean
  createdAt  DateTime @default(now())

  @@index([identifier, createdAt])
}
```
No `tenantId` â login attempts happen before a tenant is known, and this table's whole job is to be queryable by identifier across all attempts regardless of which (if any) tenant they'd resolve to.

### 1.3 Implementation

```ts
// src/lib/rate-limit.ts â new, small, no external dependency
import "server-only";
import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function isLoginLocked(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const recentFailures = await db.loginAttempt.count({
    where: { identifier, succeeded: false, createdAt: { gte: since } },
  });
  return recentFailures >= MAX_ATTEMPTS;
}

export async function recordLoginAttempt(identifier: string, succeeded: boolean, ip?: string) {
  await db.loginAttempt.create({ data: { identifier, succeeded, ip } });
  // A successful login clears the identifier's recent failure count, so a
  // legitimate user who mistyped their password twice isn't punished for
  // the rest of the 15-minute window once they get it right.
  if (succeeded) {
    await db.loginAttempt.deleteMany({ where: { identifier, succeeded: false } });
  }
}
```

```ts
// src/app/actions/auth.ts â login(), extending the existing function
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getT();
  const parsed = LoginSchema.safeParse({ /* ...unchanged... */ });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { identifier, password } = parsed.data;

  if (await isLoginLocked(identifier)) {
    // Same generic message as a wrong password â don't confirm to an
    // attacker that they've hit a lockout specifically, just that this
    // attempt didn't work. A real user who's actually locked out sees the
    // same message every time and, per 1.4, gets a way to tell what's wrong.
    return { error: t("auth.invalidCredentials") };
  }

  const user = await db.userIdentity.findFirst({ /* ...unchanged... */ });
  const passwordHash = user?.passwordHash ?? "$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal";
  const passwordValid = await bcrypt.compare(password, passwordHash);

  await recordLoginAttempt(identifier, Boolean(user && passwordValid));

  if (!user || !passwordValid) return { error: t("auth.invalidCredentials") };

  // ...unchanged membership check + createSession + redirect...
}
```

Apply the identical pattern to `authenticatePublicAccount()` in `public-signup.ts` â same shared `isLoginLocked`/`recordLoginAttempt` helper, same `LoginAttempt` table (a public-account brute-force attempt is the same threat regardless of which login form it comes through).

### 1.4 One UX decision to make deliberately

A generic "invalid credentials" message on lockout is the secure default (it doesn't tell an attacker they've found a valid, now-locked account vs. an account that never existed) but is a worse experience for a real employee who's actually locked out and doesn't know why. Given this is an internal company tool, not a public consumer product, I'd lean toward a slightly more informative message after the count is clearly exhausted â e.g. "Too many attempts. Try again in a few minutes, or contact your admin." â since the accounts here are already admin-provisioned (per the existing `requestPasswordResetAction` comment), account enumeration is a smaller concern than it would be for a public signup form. Your call; both are defensible, just pick one on purpose rather than by default.

### 1.5 Acceptance criteria
- [ ] `LoginAttempt` table added via migration.
- [ ] `login()` and `authenticatePublicAccount()` both check and record attempts through the shared helper.
- [ ] 6 consecutive failed attempts for the same identifier within 15 minutes produces a lockout response on the 6th; a successful login clears the counter.
- [ ] A test covering this (extend `tests/unit/` â this is exactly the kind of logic that's cheap to regress silently without one).

---

## 2. Track B â Security response headers

### 2.1 Target state

A `headers()` function in `next.config.ts` applying a baseline security header set to every route. This is configuration, not code â the lowest-effort, highest-ratio item in this whole phase.

### 2.2 Implementation

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Start report-only: a real CSP violation you haven't anticipated (a
  // third-party script, an inline style Tailwind injects, etc.) should
  // show up in browser console/reporting before it silently breaks a page
  // in production. Tighten to enforcing once a couple of weeks of
  // report-only traffic shows no unexpected violations.
  {
    key: "Content-Security-Policy-Report-Only",
    value: "default-src 'self'; img-src 'self' https://*.public.blob.vercel-storage.com data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  },
];

const nextConfig: NextConfig = {
  // ...existing experimental.serverActions config...
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() { /* ...unchanged... */ },
};
```

The CSP's `img-src` explicitly allows the Vercel Blob domain â this is the point where Track B here and Phase 0's storage migration intersect; if Phase 0's Blob migration landed with public image URLs, this CSP needs their exact domain, not a guess. Verify the real Blob hostname (`https://<store-id>.public.blob.vercel-storage.com`) before shipping this.

### 2.3 Acceptance criteria
- [ ] Headers present on every response (verify via `curl -I` against a deployed preview, not just reading the config).
- [ ] CSP shipped as `Report-Only` first; a follow-up task (not blocking this phase) to switch to enforcing once verified clean.
- [ ] No legitimate app functionality broken by the headers (check that Blob-hosted images, and any embedded content like the BIM/3D viewer if it loads external resources, still render).

---

## 3. Track C â Upload content-type allowlist

### 3.1 Target state

`readUploadedFile()` (currently duplicated across `project-photos.ts`, `project-renders.ts`, `unit-renders.ts`) validates `file.type` against an explicit allowlist per upload context, instead of trusting whatever the browser reports.

### 3.2 Implementation

```ts
// src/lib/uploads.ts â new, shared, replaces the near-identical
// readUploadedFile() currently copy-pasted across three action files
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function readUploadedImage(formData: FormData, field = "file", maxBytes = 8 * 1024 * 1024) {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) throw new Error("Attach a file.");
  if (file.size > maxBytes) throw new Error(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)}MB).`);
  if (!IMAGE_MIME_TYPES.has(file.type)) throw new Error("Unsupported file type â use JPEG, PNG, or WebP.");
  const data = new Uint8Array(await file.arrayBuffer());
  return { data, mimeType: file.type, size: file.size };
}
```

This also folds in the module-consolidation instinct from Phase 0 Track D â three copies of the same function become one shared one, since they were never behaviorally different to begin with.

`DocumentFile` uploads (contracts, drawings, specifications) need a different, wider allowlist (PDF, DOCX, DWG, etc.) â don't force those through the same `IMAGE_MIME_TYPES` set; give that upload path its own allowlist constant next to this one.

### 3.3 Acceptance criteria
- [ ] A single shared upload-validation helper replaces the duplicated logic in `project-photos.ts`, `project-renders.ts`, `unit-renders.ts`.
- [ ] Uploading a non-image file through a photo/render upload is rejected with a clear error, verified by a test.
- [ ] Document uploads (contracts/drawings) get their own explicit allowlist, not the image one.

---

## 4. Sequencing

```
Track B (security headers)  âââ config-only, zero code risk, do first
Track A (rate limiting)     âââ schema migration + shared code path used by
                                 two login functions â moderate care needed,
                                 do second
Track C (upload allowlist)  âââ lowest urgency, do last, bundle with any
                                 other small cleanup pass
```

---

## 5. Definition of Done for Phase 3

- [ ] Both login paths (tenant login and public-account login) are rate-limited via the shared `LoginAttempt` mechanism.
- [ ] Security headers, including a report-only CSP, are live on every response.
- [ ] Image uploads validate content type against an explicit allowlist; the duplicated upload-parsing logic is consolidated to one helper.
- [ ] Zero new business features shipped during this phase.

## 6. What comes next (not in scope here)

Switching CSP from report-only to enforcing once verified clean; IP-based (not just identifier-based) rate limiting if credential-stuffing across many usernames from one source ever becomes a real pattern; and a dependency-vulnerability scan (`npm audit` / Dependabot) wired into the CI pipeline Phase 0 already set up â cheap to add, held out of this phase only because it's a GitHub setting, not application code, and belongs with a broader "keep dependencies current" habit rather than a one-time PRD item.
