# Construction OS (Nesto) â PRD: Phase 19, Resolving the Deployment Reality v1.0

**Status:** Draft for implementation â **verification and documentation-integrity task, not a code fix**
**Owner:** Lindo (solo full-stack)
**Depends on:** none â this closes a question Phase 0 opened at the very start of this review and three later phases have each independently bumped into again
**Scope:** one schema comment, and whatever it turns out to actually require once verified against the real Vercel/Neon account â no new business modules.

---

## 0. What I found â the full evidence trail, assembled in one place for the first time

Phase 0 opened this review with an unresolved contradiction: `schema.prisma`'s header claims *"Deployed to Vercel + Neon Postgres on 2026-08-07,"* while `datasource.provider` says `"sqlite"` and `migration_lock.toml` agrees. That phase recommended investigating before building anything else on top of the assumption either way. Across the phases since, more evidence has turned up pointing the same direction, each time as a side note rather than the main finding â worth pulling together now rather than letting a fourth phase stumble into it independently:

| Evidence | What it suggests |
|---|---|
| `schema.prisma` header comment | Claims Postgres/Neon deployment happened on a specific date |
| `datasource.provider = "sqlite"` | Contradicts the above â a `sqlite` client cannot connect to a Postgres URL |
| `migration_lock.toml` â `provider = "sqlite"` | All 56 migrations were generated for SQLite's dialect, not Postgres's |
| `package.json` has no `@vercel/blob`, `resend`, `@sentry/nextjs`, or any object-storage/email/monitoring dependency | None of the infrastructure a real production deployment on this stack would need is installed |
| Only one `process.env.*` reference anywhere in `src/lib`/`src/server`: `AUTH_SECRET` | No `DATABASE_URL` handling beyond what Prisma reads internally, no `BLOB_READ_WRITE_TOKEN`, no `RESEND_API_KEY` â nothing a live Postgres+Blob+email deployment would be configured with |
| `Employee.photoDataUrl`'s own schema comment: *"this app has no object storage anywhere... every other 'document' feature is metadata-only"* | A second, independent comment in the same schema file flatly stating the opposite of the header's claim |

Five independent signals, all pointing the same direction, none pointing the other way. **The most likely explanation is that the header comment describes a planned or aspirational future state that was never actually executed** â possibly written as a forward-looking note during planning, or copied from a different environment's documentation, and never corrected. This isn't a dramatic discovery so much as a loose thread worth tying off before it causes confusion: several proposals in this review series (the storage migration, the email integration, the monitoring setup) were framed as "close the gap between what's claimed and what exists" â if the claim itself is simply wrong, those proposals are still exactly the right work, just starting from a clearer, honestly-stated baseline instead of a partially-contradicted one.

---

## 1. The fix

### 1.1 Verify, don't guess â this requires checking the actual Vercel/Neon account, which is outside what a code review can determine

This phase's first deliverable is a short, concrete checklist to run against the real infrastructure, not more code archaeology:

1. Log into the Vercel dashboard for this project. Check the production deployment's environment variables: is `DATABASE_URL` set, and does it point to a Neon Postgres connection string or a local/ephemeral SQLite path?
2. If a Neon project exists under this account, check its actual schema (via the Neon console or `psql`) against what's in `prisma/schema.prisma`. Do the tables match? Is there real data in it, or is it empty?
3. Check whether a `BLOB_READ_WRITE_TOKEN` or equivalent exists in the Vercel project's environment variables at all.
4. Check the most recent production deployment's build logs and timestamp against the git commit that added the "Deployed... on 2026-08-07" comment â did a deployment actually happen around that date, and did it succeed?

### 1.2 Two possible outcomes, and what each one means for the rest of this review

**Outcome A â nothing was actually deployed; the comment is simply inaccurate.** This is what the internal evidence points to. If confirmed: correct the schema comment to reflect reality (state plainly that the app is SQLite-only, local-dev-only, and Postgres migration is still pending), and treat **Phase 0 of this review as the actual, still-needed starting point** â not a formality to skip because the schema claims it's done. Every phase since has been written as if Phase 0 might already be in progress or complete; if it never started, the practical sequencing advice is: do Phase 0 for real, first, before any phase that assumes Postgres, Blob storage, or Resend exists (Phases 0, 2, 3's email piece, 5's Sentry, 13).

**Outcome B â something was deployed, just not the way the code implies.** Possible if, for instance, a Neon database exists and is being written to via a different mechanism than the committed `schema.prisma` (a manually-run `db push` against an uncommitted schema variant, or a deployment that predates the current `main` branch state). If this is the case, this is a more serious finding than Outcome A: it means production and the committed schema have silently diverged, which is a data-integrity risk in its own right â any future `prisma migrate deploy` against a real, diverged production database could fail or, worse, silently do the wrong thing. This outcome would need its own follow-up phase (reconcile the live schema against the committed one) before anything else proceeds.

### 1.3 Acceptance criteria
- [ ] The checklist in Â§1.1 is actually run against the real Vercel/Neon account, with the answer recorded (not assumed).
- [ ] The `schema.prisma` header comment is corrected to state the verified truth, whichever outcome it turns out to be.
- [ ] If Outcome A: Phase 0 of this review is explicitly scheduled as still-pending, first-priority work, not skipped as already-done.
- [ ] If Outcome B: a new phase is opened specifically to reconcile the live database against the committed schema before any further migration work touches it.

---

## 2. Why this is worth a whole phase instead of a footnote

Every fix proposed since Phase 0 that assumes a piece of infrastructure exists (Blob storage, Resend, Postgres itself) is only as good as that assumption. Shipping Phase 2's email integration code against a codebase that turns out to still be SQLite-only with no `DATABASE_URL` even pointed anywhere real would mean writing code that can't actually run in production yet, sequenced as if it could. This phase's entire value is making sure the next unit of real engineering work starts from a floor that's actually solid, rather than continuing to build on a claim nobody has actually checked.

## 3. Definition of Done for Phase 19

- [ ] The actual deployment state is known with certainty, not inferred from code alone.
- [ ] The schema comment matches reality.
- [ ] The correct next phase (Phase 0 for real, or a schema-reconciliation phase) is explicitly identified and prioritized based on the verified outcome.
- [ ] Zero new business features shipped during this phase â this is entirely a verification and correction task.

## 4. What comes next (not in scope here)

Whichever of Â§1.2's two outcomes is confirmed determines the actual next phase, and it isn't a new discovery â it's picking up either Phase 0 (this review's very first PRD) or a new schema-reconciliation phase, both already scoped enough to start immediately once the verification in Â§1.1 is done.
