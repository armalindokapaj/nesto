# Construction OS (Nesto) â PRD: Phase 2, Notification Delivery & Long-Running Work v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 0 (Postgres + CI), Phase 1 (access scoping + audit coverage)
**Scope:** no new business modules; this phase gives existing events a real delivery channel and fixes the one write path that's actually at risk of timing out â without introducing a job queue this system doesn't need yet.

---

## 0. What I found

Two things, both traced to specific code, both smaller than "notifications system" and "job queue" sound:

| # | Finding | Evidence |
|---|---|---|
| A | **Every notification in the system is an in-app row only. There is no email, SMS, or push channel anywhere in the codebase.** `NotificationPolicy` (`src/server/event-centre.ts`) has an `inAppEnabled` field and nothing else â no `emailEnabled`, no external send call. `package.json` has no email/SMS provider dependency at all (checked for Resend, Nodemailer, SendGrid, Twilio, Postmark, SES â none present). For a construction OS, this matters specifically because the Event Catalogue already names events like `HSE.STOP_WORK_ISSUED` (sensitivity: `EMERGENCY`) and `HSE.INCIDENT_REPORTED` (`RESTRICTED`) â a stop-work order that only shows up as a bell icon someone has to notice while logged in isn't doing the job an emergency alert needs to do. |
| B | **One real timeout/lock-contention risk exists, and it's not general â it's `calculatePayrollRun()`.** `src/server/payroll.ts` runs a `for` loop over every active employee inside a single `db.$transaction`, doing one `findFirst` + one `create` per employee, sequentially. For a payroll run covering hundreds of employees, that's hundreds of sequential round-trips held inside one open transaction, inside one serverless function invocation â a real risk against both Vercel's execution duration limit and Neon's pooled-connection behavior (long-held transactions on a pooler are exactly what pooling is bad at). The code comments in `import-center.ts` and `unit-import.ts` are explicit that *"this app has no job queue"* â a deliberate Phase 0/1 simplification, correctly scoped at the time, that this one function has now outgrown. |

Neither of these needs a job queue, a worker service, or a new piece of infrastructure. A gets solved by adding one delivery channel to an already-well-designed publish function. B gets solved by fixing an N+1 query pattern. I want to be explicit about that because "notifications" and "background jobs" are the kind of phase names that invite overbuilding, and neither is warranted here yet.

---

## 1. Track A â Add a real delivery channel to the Event Centre

### 1.1 Target state

- `publishEvent()` (already correct, already governed by policy, already deduplicated) gains one more thing it can do per event: send an email, gated by the same per-event policy mechanism that already exists for in-app.
- No SMS, no push notifications, no per-user channel preferences beyond what's needed. Email is the right first channel: every user already has to have logged in via a username (check whether `UserIdentity` has an email field â if not, that's the one schema addition this track needs), it's the cheapest to implement correctly, and it covers the actual named use cases (stop-work, incident, expiring supplier docs) without building a mobile push infrastructure this app has no other use for yet.
- **No queue.** Sending one transactional email via a provider's HTTP API takes ~100â300ms. That happens inline, inside the same `publishEvent()` call, the same way the existing `db.notification.createMany` and `db.auditEvent.create` calls already do. A queue would be solving a latency problem this doesn't have.

### 1.2 Provider choice

**Resend.** It's built for exactly this (transactional email from a Next.js app), has a generous free tier for a project this size, and its SDK is a single `npm install resend` with no separate infrastructure to provision â consistent with the Vercel-native stack the rest of this project already leans on. Don't reach for a heavier ESP (SendGrid, Postmark) or a generic SMTP setup; there's no requirement here that Resend doesn't meet.

### 1.3 Schema changes

```prisma
// NotificationPolicy â add one field
model NotificationPolicy {
  // ...existing fields
  emailEnabled Boolean @default(false)   // per-event opt-in, defaults off â don't email-blast every event by default
}
```

Check `UserIdentity` for an existing email field before adding one; if `CompanyMembership` or onboarding already captures it (worth verifying â `public-signup.ts` is the place to check), reuse it rather than adding a duplicate column.

### 1.4 Implementation

```ts
// src/lib/email.ts â new, small, the only new dependency this track adds
import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  try {
    await resend.emails.send({ from: "Nesto <notifications@yourdomain.com>", ...params });
  } catch (err) {
    // Log and swallow â an email failure must never fail the underlying
    // business action (a stop-work order still gets issued and shown
    // in-app even if the email bounces). See 1.5 for what "failed silently"
    // means in practice.
    console.error("sendEmail failed", err);
  }
}
```

```ts
// src/server/event-centre.ts â publishEvent(), extending the existing function
export async function publishEvent(
  tenantId: string,
  eventKey: string,
  input: { recipientIds: string[]; title: string; body?: string; link?: string; actorId?: string }
) {
  const policy = await db.notificationPolicy.findUnique({ where: { tenantId_eventKey: { tenantId, eventKey } } });
  const inAppEnabled = policy?.inAppEnabled ?? true;
  const emailEnabled = policy?.emailEnabled ?? false;
  if (!inAppEnabled && !emailEnabled) return { published: 0, skipped: input.recipientIds.length };

  // ...existing dedup + in-app createMany logic, unchanged...

  if (emailEnabled && targets.length) {
    const recipients = await db.userIdentity.findMany({ where: { id: { in: targets } }, select: { id: true, email: true } });
    await Promise.all(
      recipients
        .filter((r) => r.email)
        .map((r) => sendEmail({ to: r.email!, subject: input.title, html: `<p>${input.body ?? ""}</p>${input.link ? `<p><a href="${input.link}">View in Nesto</a></p>` : ""}` }))
    );
  }
  // ...existing auditEvent.create + return...
}
```

`Promise.all` here is fine and not the same risk as Track B's payroll loop â this is a handful of independent HTTP calls with no open database transaction wrapping them, not a sequential DB round-trip loop.

### 1.5 What "swallow the error" means operationally

Track D from Phase 1 (the domain-event failure visibility page) already established the pattern of "make failures visible, don't build a queue to auto-retry them." Apply the same here: log the failure server-side for now. If email delivery failure rate turns out to matter in practice, the extension is a `EmailDeliveryLog` table and a row on that same admin page â not a queue. Don't build that pre-emptively; add it if it's needed.

### 1.6 Which events get `emailEnabled = true` by default

Set the default policy (in `EVENT_CATALOGUE`'s seed) to `emailEnabled: true` only for `sensitivity: "EMERGENCY"` and `"RESTRICTED"` events â `HSE.STOP_WORK_ISSUED`, `HSE.INCIDENT_REPORTED`. Leave `STANDARD` and `INTERNAL` events (progress claims, PO issued, report executed) as in-app only by default; an Owner can flip individual events on from the same admin screen that already manages `NotificationPolicy`. This keeps the default behavior conservative â nobody's inbox gets flooded by a schema change.

### 1.7 Acceptance criteria
- [ ] `RESEND_API_KEY` in env, `.env.example` updated (continuing Phase 0's convention).
- [ ] `NotificationPolicy.emailEnabled` field added; `EMERGENCY`/`RESTRICTED` events default to `true`, everything else defaults to `false`.
- [ ] A stop-work or incident event sends a real email to every recipient with a valid address, verified against a real (not sandboxed) Resend send in staging.
- [ ] An email provider outage does not prevent the underlying event from publishing in-app or block the action that triggered it (e.g., issuing the stop-work order itself never fails because of an email error).

---

## 2. Track B â Fix the payroll calculation loop

### 2.1 Target state

`calculatePayrollRun()` does two batched queries and two batched writes instead of 2ÃN sequential ones. Same transaction, same business logic, same output â this is a pure performance rewrite with no behavior change, which is exactly why it's safe to do without new infrastructure.

### 2.2 Concrete change

```ts
// Before â inside the existing db.$transaction:
for (const candidate of candidates) {
  const currentSalary = await tx.salaryRecord.findFirst({
    where: { tenantId, employeeId: candidate.employeeId, status: "CURRENT" },
    orderBy: { effectiveStartDate: "desc" },
  });
  if (!currentSalary) continue;
  await tx.payrollRunLine.create({ data: { /* ... */ } });
  linesCreated += 1;
}

// After
const employeeIds = candidates.map((c) => c.employeeId);
const currentSalaries = await tx.salaryRecord.findMany({
  where: { tenantId, employeeId: { in: employeeIds }, status: "CURRENT" },
  orderBy: { effectiveStartDate: "desc" },
});
// one CURRENT salary record is expected per employee, but findMany + a
// map keeps this correct even if that invariant is ever violated â
// first-seen-wins, same as the old findFirst's ordering.
const latestSalaryByEmployee = new Map<string, (typeof currentSalaries)[number]>();
for (const s of currentSalaries) {
  if (!latestSalaryByEmployee.has(s.employeeId)) latestSalaryByEmployee.set(s.employeeId, s);
}

const lines = candidates
  .map((c) => {
    const salary = latestSalaryByEmployee.get(c.employeeId);
    if (!salary) return null;
    return {
      tenantId,
      payrollRunId: runId,
      employeeId: c.employeeId,
      employmentRelationshipId: c.employmentRelationshipId,
      salaryRecordId: salary.id,
      grossSalary: salary.grossSalary,
      netSalary: salary.netSalary,
      currency: salary.currency,
      calculationTrace: `source: SalaryRecord ${salary.id} (effective ${salary.effectiveStartDate.toISOString().slice(0, 10)}); formula: pass-through, no deductions applied; rounding: none`,
    };
  })
  .filter((l): l is NonNullable<typeof l> => l !== null);

await tx.payrollRunLine.createMany({ data: lines });
const linesCreated = lines.length;
```

This turns a 2ÃN-round-trip transaction into a fixed 3-query transaction (one `findMany`, one `createMany`, one `update`) regardless of company size. That removes the timeout risk directly â no cron, no queue, no status polling required.

### 2.3 Should the import CSV loops get the same treatment?

Checked (`import-center.ts`'s `commitEmployees`, `unit-import.ts`): these use per-row sequential `create` deliberately, to attribute a specific error to a specific row on failure â `createMany` doesn't give per-row error results the same way, so this isn't the same mistake as payroll's read-then-write loop. Leave these as-is for now; they're bounded by realistic CSV sizes (an employee roster, not a transaction ledger) and the deliberate tradeoff is documented in the code. If a customer ever imports a CSV large enough for this to matter in practice, the fix is chunked concurrency (`Promise.all` over batches of ~20 rows) â flag for later, not needed now.

### 2.4 Acceptance criteria
- [ ] `calculatePayrollRun()` uses batched `findMany`/`createMany`, verified to produce identical `PayrollRunLine` rows to the old implementation against the seeded QA fixtures (add a test comparing output if one doesn't already cover this).
- [ ] A payroll run for a company-sized fixture set (extend the QA seed to ~200 employees if it isn't already that large) completes well inside Vercel's function duration limit â measure it, don't just assume the fix worked.
- [ ] No other server file has the same read-in-a-loop-inside-a-transaction shape â worth a quick `grep -n "for (" src/server/*.ts` pass to confirm this was the only instance, not just the only one that happened to get noticed.

---

## 3. Sequencing

```
Track B (payroll loop fix)  âââ independent, pure refactor, zero external
                                 dependency, do first
Track A (email delivery)    âââ needs RESEND_API_KEY provisioned and a
                                 verified sending domain â has real lead
                                 time (domain verification isn't instant),
                                 so start the account/domain setup in
                                 parallel with Track B's code work
```

Recommended order: start the Resend account + domain verification immediately (it has external lead time), do Track B's code fix while that's pending, then finish Track A once the domain is verified.

---

## 4. Definition of Done for Phase 2

- [ ] Emergency/restricted HSE events send real email in addition to in-app notification, gated by per-event policy, defaulting conservatively.
- [ ] Email send failures never block the underlying business action.
- [ ] `calculatePayrollRun()` no longer has an unbounded per-employee sequential loop inside its transaction.
- [ ] No job queue, worker service, or new infrastructure introduced â this phase stays inside the existing request/response model.
- [ ] Zero new business features shipped during this phase.

## 5. What comes next (not in scope here)

Per-user notification channel preferences (right now the org sets policy per event, not per person â fine for a first release, revisit if requested); SMS for the same emergency events, once there's a specific reason email isn't enough; and a genuine background-job mechanism (Vercel Cron or Upstash QStash, still no custom worker) â but only once a concrete need appears that a batched query can't solve, the same way Track B's fix solved payroll without one.
