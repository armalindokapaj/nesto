# Construction OS (Nesto) â PRD: Phase 5, Observability & Error Handling v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 0 (CI pipeline, to carry source-map upload)
**Scope:** no new business modules; this phase is about what happens the first time something goes wrong in production, and whether anyone finds out.

---

## 0. What I found

Right now, if something breaks in production, two things are true: **nobody gets told, and the user sees a raw crash.**

| # | Finding | Evidence |
|---|---|---|
| A | **No error monitoring service anywhere.** `package.json` has no Sentry, no logging service, nothing. `console.error` and `console.log` both return zero matches across the entire `src/` tree â not "underused," genuinely absent. The only place an unhandled error goes today is Vercel's raw function logs, which nobody is alerted on and nobody is going to tail proactively. |
| B | **Zero `error.tsx` files anywhere in the App Router.** `find src/app -iname "error.tsx"` returns nothing â not at the root, not in `(workspace)`, not in any route segment. Next.js's entire error-boundary mechanism for this exact situation (a Server Component throws, a data fetch fails) is unused. Today, an unhandled exception anywhere in a page render shows Next's generic, unbranded crash screen to whoever's using the app â an employee mid-task, a client viewing their project â with no way back in except reloading and hoping. |
| C | **88 places across `src/app/actions/*.ts` return `error.message` straight to the client.** The dominant pattern is `catch (err) { return { error: err instanceof Error ? err.message : "fallback" } }`. Most of the time this is fine and even good â the codebase's convention is to `throw new Error("Invoice not found.")` with a deliberately user-appropriate message. But nothing distinguishes an intentional business-rule message from a raw Prisma error (a constraint violation, a connection timeout) if one ever escapes uncaught into the same catch block â and at that point, whatever internal detail Postgres or Prisma put in that message goes straight to the end user's screen. |

None of this needs a rewrite. A is a vendor integration, B is a handful of small files following a pattern Next.js already provides, C is one targeted `instanceof` check added to an existing pattern, not a rearchitecture of 88 call sites.

---

## 1. Track A â Error monitoring (Sentry)

### 1.1 Why Sentry, specifically

Same reasoning as Resend for email and Neon for Postgres in earlier phases: pick the option that's purpose-built, has a real free tier at this project's scale, and requires the least new infrastructure to operate. `@sentry/nextjs` auto-instruments Server Components, Server Actions, Route Handlers, and client-side React errors with a few config files â no manual `try/catch`-and-report sprinkled through the codebase, no custom logging pipeline to build or maintain. This is the one place in the whole roadmap so far where reaching for a vendor is the *simple* answer, not the complex one â building an equivalent from scratch (structured logging, alerting, stack trace grouping, source-mapped production errors) is real work that a $0â26/mo SaaS already does well.

### 1.2 Implementation

```bash
npx @sentry/wizard@latest -i nextjs
```
This generates `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, and wraps `next.config.ts` with `withSentryConfig` (which also wires up source-map upload). Point it at a new Sentry project, set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in Vercel env vars and CI (Phase 0's `.env.example` gets these two new entries).

Two settings worth being deliberate about rather than accepting the wizard's defaults:
- **`tracesSampleRate`**: start low (0.1 or lower) â this is a construction ERP with real usage patterns, not a project that needs 100% transaction tracing from day one, and full tracing has a real cost both in Sentry quota and request overhead.
- **Scrub sensitive data before send.** Sentry's SDK captures request context by default â make sure payroll figures, compensation data, and file contents in request bodies aren't included in captured events. `beforeSend` hooks or Sentry's built-in data-scrubbing config should explicitly strip known-sensitive field names (`grossSalary`, `netSalary`, `passwordHash`, etc.) â don't ship this pointed at production before checking what a captured payroll-run error actually contains.

### 1.3 Acceptance criteria
- [ ] A deliberately-thrown test error in a Server Action shows up in the Sentry dashboard within a couple of minutes, correctly source-mapped to the actual TypeScript line (not minified output).
- [ ] `beforeSend` scrubbing verified against at least one real payroll/HR-adjacent error to confirm no compensation or credential data reaches Sentry.
- [ ] `SENTRY_DSN`/`SENTRY_AUTH_TOKEN` added to `.env.example`, Vercel env, and the CI workflow from Phase 0.

---

## 2. Track B â Error boundaries

### 2.1 Target state

Two `error.tsx` files, not one per route segment â that would be over-scoping this for a system with dozens of route segments and no evidence yet that any one of them needs bespoke error handling.

```tsx
// src/app/error.tsx â catches anything the workspace-level boundary doesn't
"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-muted">The team has been notified. Try again, or reload the page.</p>
            <button onClick={reset} className="mt-4 rounded bg-ink px-4 py-2 text-sm text-white">Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

```tsx
// src/app/(workspace)/error.tsx â same idea, but rendered inside the
// workspace shell (nav/sidebar stay visible) instead of blanking the
// whole page, since this is the boundary that actually catches almost
// everything (every real page lives under this route group)
"use client";
export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <h2 className="text-base font-semibold">This page couldn't load</h2>
        <p className="mt-2 text-sm text-ink-muted">The team has been notified. Try again, or go back to your dashboard.</p>
        <button onClick={reset} className="mt-4 rounded bg-ink px-4 py-2 text-sm text-white">Try again</button>
      </div>
    </div>
  );
}
```

Both automatically get reported to Sentry once Track A's SDK is installed â Next.js's error boundary and Sentry's Next.js integration are designed to work together with no extra wiring beyond both being present.

### 2.2 Acceptance criteria
- [ ] A forced error inside a `(workspace)` page shows the branded fallback with the nav shell intact, not Next's default crash screen.
- [ ] The same forced error appears in Sentry.
- [ ] `reset()` actually recovers the page without a full reload, verified manually.

---

## 3. Track C â Stop leaking raw errors to the client

### 3.1 Target state

The 88-site pattern stays exactly as it is for genuine business-rule errors (`"Invoice not found."`, `"A locked payroll run cannot be recalculated."`) â those messages are fine for a user to see and rewriting 88 call sites for no functional gain would be exactly the kind of busywork this project doesn't need. The fix targets the one specific leak class: **raw Prisma errors escaping uncaught.**

### 3.2 Implementation

```ts
// src/lib/errors.ts
import { Prisma } from "@/generated/prisma";
import * as Sentry from "@sentry/nextjs";

/**
 * Use this instead of `err instanceof Error ? err.message : fallback` in
 * action catch blocks. Deliberately-thrown business errors (plain `new
 * Error("...")`, thrown by the code in this app) pass through unchanged â
 * their message was always meant for the user. A Prisma error, or anything
 * that isn't a plain Error, is logged to Sentry with full detail and
 * replaced with a generic message, since its raw text was never meant to
 * be user-facing.
 */
export function toActionError(err: unknown, fallback: string): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientUnknownRequestError) {
    Sentry.captureException(err);
    return fallback;
  }
  if (err instanceof Error) return err.message;
  Sentry.captureException(err);
  return fallback;
}
```

Then each of the 88 sites becomes a one-line change:
```ts
// Before
return { error: err instanceof Error ? err.message : "Could not create revision" };
// After
return { error: toActionError(err, "Could not create revision") };
```
Mechanical, low-risk, and doesn't touch the actual business logic in any of these files â this is a search-and-replace pass, not a redesign. Worth doing across all 88 sites in one pass precisely because each individual change is trivial and reversible; leaving half of them on the old pattern would just mean half the leak surface remains closed.

### 3.3 Acceptance criteria
- [ ] `src/lib/errors.ts` added.
- [ ] All 88 identified call sites updated to `toActionError()`.
- [ ] A forced Prisma error (e.g., a unique constraint violation) returns the generic fallback to the client and the full error to Sentry â verified with a test or manual trigger, not just by reading the code.
- [ ] A genuine business-rule error (e.g., attempting to recalculate a locked payroll run) still shows its real, specific message â confirm this didn't get generic-ized by mistake.

---

## 4. Sequencing

```
Track A (Sentry)           âââ do first; Tracks B and C both depend on
                                Sentry.captureException being available
Track B (error boundaries) âââ quick, do second
Track C (error scrubbing)  âââ mechanical but touches 88 files; do last,
                                and consider splitting into a couple of
                                PRs by module rather than one giant diff
```

## 5. Definition of Done for Phase 5

- [ ] Sentry captures server and client errors in production, with source maps and sensitive-field scrubbing verified.
- [ ] Root and workspace-level `error.tsx` boundaries replace Next's default crash screen with a branded, recoverable fallback.
- [ ] No raw Prisma error text can reach an end user; genuine business-rule messages are untouched.
- [ ] Zero new business features shipped during this phase.

## 6. What comes next (not in scope here)

Per-module `error.tsx` boundaries for any specific page that turns out to need bespoke recovery behavior (e.g., a partially-submitted multi-step form that shouldn't just reset) â add only where a real case shows up, not pre-emptively; Sentry alerting rules (Slack/email on new error types or spike thresholds) once there's enough production traffic for a baseline to alert against; and extending the same `toActionError()` convention to any new action file written after this phase, as a lint rule or code-review habit rather than a one-time migration.
