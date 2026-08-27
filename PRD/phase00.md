# Construction OS (Nesto) â PRD: Phase 0, Foundation Hardening v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Scope:** `NestoWeb` â no new business modules in this phase
**Principle governing every decision below:** simple beats complex; clarity beats backward-compatibility. Where a "correct" solution and a "simple" solution diverge, this doc picks simple and says so.

---

## 0. Why this phase exists

Nesto already has real breadth â 274 Prisma models, ~20 business modules, tenant-isolated auth, a permission matrix, and a real test suite. That's not the risk. The risk is that four foundational pieces haven't kept pace with the module count, and every new module built on top of them inherits the debt. Phase 0 touches zero business logic and fixes exactly four things:

| # | Finding | Why it's Phase 0, not later |
|---|---|---|
| A | **Datasource reality is unverified.** `schema.prisma`'s header comment claims *"Deployed to Vercel + Neon Postgres on 2026-08-07"*, but `datasource db { provider = "sqlite" }` and `prisma/migrations/migration_lock.toml` both still say `sqlite`. Prisma cannot connect a `sqlite` client to a Postgres connection string â one of these two facts is wrong. | Every other track in this doc assumes we know which database is actually running in production. We don't, yet. |
| B | **Binary files live inside the database.** `ProjectRender.fileData`, `ProjectPhoto.fileData`, `UnitRender.fileData`, `DocumentFile.fileData` are `Bytes` columns. `Drawing`, `DrawingRevision`, `Submittal`, `Specification`, `Calculation` store `fileDataUrl` as base64 **text** â ~33% larger than the raw file, sitting in a `String` column with no size cap. For a construction OS whose core deliverables are drawings, site photos, and BIM assets, this is the wall you hit first, not last. | Every real customer's first action (upload a drawing, upload a site photo) writes into this table. The longer real data accumulates here, the more painful the migration. |
| C | **No CI.** Tests exist (`vitest`, `playwright`) but nothing runs them automatically. Every deploy today is "it built on my machine." | Free to fix, compounds daily, and is a prerequisite for trusting Track A and B changes. |
| D | **Module file sprawl.** Parallel same-domain files (`documents.ts`/`documents-module.ts`, `finance.ts`/`finance-module.ts`/`finance-dashboard.ts`/`finance-budget.ts`/`finance-spendings.ts`, `contracts.ts`/`contracts-module.ts`) make it hard for one person to know where a given piece of logic lives. | Not urgent, but every week of delay adds another file to the pile. Cheapest to do now, before Track A/B changes land on top of it. |

**Explicitly out of scope for Phase 0:** record-level permissions, audit-log completeness, notifications delivery, background jobs. Those are real and listed in the follow-up roadmap, but they're additive work on a stable foundation â this doc is about making the foundation stable first.

---

## 1. Track A â Confirm and correct the datasource

### 1.1 Investigate first (half a day, before touching anything)

This is a discovery task, not a migration task. Do these in order and record the answer to each:

1. Check the actual `DATABASE_URL` value used by the deployed Vercel project (Vercel dashboard â Project â Settings â Environment Variables, or `Vercel:get_project`). Is it a `postgres://`/`postgresql://` string (Neon) or a local SQLite file path?
2. If it's a Neon URL: how is the app connecting to it with `provider = "sqlite"` in schema.prisma? Likely explanations, cheapest to rule out first:
   - The deployed build is stale and was never redeployed after the schema comment was written (check `Vercel:list_deployments` timestamps vs. the git commit that added the comment).
   - Someone ran `prisma db push` by hand against Neon from a different, uncommitted schema file, and the committed `schema.prisma` was never updated to match. Check Neon directly (`Kernel`/Neon MCP, or `psql`) for the actual live table structure and compare against the committed schema.
3. If it's still a local SQLite path in production: the comment is aspirational and the migration described below hasn't happened yet. This is actually the simpler outcome â proceed straight to 1.2.

**Do not proceed to 1.2 until you can state, with evidence, which of these three is true.** If it's outcome 2 (schema/db drift), that's a data-loss risk that needs its own remediation before anything else in this document.

### 1.2 Target state

- `datasource.provider = "postgresql"`, pointed at a Neon project (already available via the `neon`/`neon-postgres` skill already present in this repo â use it, don't set up Postgres a different way).
- **Keep Prisma.** The Neon skill's default recommendation is Drizzle; ignore that here. You have a 7,300-line schema and 56 migrations already modeled in Prisma. Swapping ORMs is a multi-week rewrite that buys nothing in this phase â it's the textbook overengineering move. Prisma has fully supported Postgres for years; this is a config and migration-history change, not an ORM change.
- One Neon **branch per environment** (production, staging) using Neon's copy-on-write branching â this replaces any home-grown "reset the dev DB" tooling and is effectively free.
- Use the **pooled** Neon connection string (`-pooler` suffix) for the app's runtime `DATABASE_URL`, and the **direct** connection string for `prisma migrate deploy` in CI. Serverless/edge functions opening unpooled connections is the single most common way to blow through Postgres's connection limit.

### 1.3 Migration steps

```bash
# 1. Point at Neon (direct connection, for the migration step itself)
export DATABASE_URL="postgresql://<user>:<pass>@<neon-host>/<db>?sslmode=require"

# 2. Flip the provider
```
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```
```bash
# 3. SQLite's 56 migrations were generated against SQLite's SQL dialect and
#    will not replay cleanly against Postgres. Do not try to "fix" them.
#    Reset migration history instead:
rm -rf prisma/migrations
npx prisma migrate dev --name init_postgres

# 4. Re-seed and validate
npm run db:seed
npm run db:seed:qa
npm test
npm run test:e2e
```

**Why reset history instead of porting 56 migrations:** SQLite and Postgres diverge on type affinity, `AUTOINCREMENT` vs `SERIAL`/identity columns, and case sensitivity. Trying to hand-port 56 migration files is exactly the kind of complexity this project doesn't need â since there's no production data yet in the *real* target (per 1.1's investigation), a clean `init_postgres` migration is simpler and safer than a ported history. If 1.1 reveals there *is* live Postgres data already, this step changes to a `prisma db pull` + reconcile instead â flag that back before running the above.

### 1.4 Two schema details to check now, while you're in there

- `checksum String? // SHA-256 hex of fileData` on `DocumentFile` â keep this; it becomes the integrity check for Track B (comparing the DB-recorded hash against the blob after migration).
- The single `Json` field in the whole schema â confirm it's read/written through Prisma's typed `Json` handling both before and after the switch (Postgres's native JSONB vs. SQLite's text-based JSON emulation behave differently on query filters, though not on plain read/write).

### 1.5 Acceptance criteria
- [ ] Root cause of the schema/deployment discrepancy documented (which of the three outcomes in 1.1 it was).
- [ ] `datasource.provider = "postgresql"` committed, matching what's actually deployed.
- [ ] Fresh migration history, applied cleanly to a Neon branch.
- [ ] Full test suite green against Postgres (not just SQLite) â this is the first time these tests will have run against the real target database.
- [ ] Staging and production Neon branches both provisioned, pooled connection strings set as Vercel env vars.

---

## 2. Track B â File storage out of the database

### 2.1 Target state

- **Vercel Blob**, not S3. You're already deploying to Vercel (per the schema comment and the connected Vercel MCP tooling); Vercel Blob is one dependency, no IAM policies, no bucket configuration, and a native Next.js upload helper. This is the "simple beats complex" call â S3 is more standard, but it's more moving parts for zero functional gain at this scale. Revisit only if you outgrow Blob's limits, which is a good problem to not have yet.
- Every model currently holding `Bytes` or a base64 `fileDataUrl` instead holds a **Blob URL (string) + metadata**. The database goes back to only storing what it's good at: structured metadata and relationships.

### 2.2 Schema changes

Applies to `ProjectRender`, `ProjectPhoto`, `UnitRender`, `DocumentFile` (currently `Bytes`) and `Drawing`, `DrawingRevision`, `Submittal`, `Specification`, `Calculation` (currently base64 `fileDataUrl` text):

```prisma
// Before (ProjectPhoto, ProjectRender, UnitRender, DocumentFile pattern)
fileData     Bytes
fileMimeType String
fileSize     Int

// After
fileUrl      String   // Vercel Blob URL â the single source of truth for content
fileMimeType String
fileSize     Int
checksum     String?  // SHA-256 hex â keep for integrity verification
```

```prisma
// Before (Drawing, DrawingRevision, Submittal, Specification, Calculation)
fileDataUrl String?

// After
fileUrl     String?  // Vercel Blob URL, replaces the base64 string
```

No new tables, no new relations â this is a column-type change plus a data backfill, which is exactly the scope Phase 0 should have.

### 2.3 Migration steps

1. **Write the backfill script first**, run it against a copy of production data before touching the schema:
   ```ts
   // scripts/migrate-files-to-blob.ts
   import { put } from "@vercel/blob";
   import { db } from "@/lib/db";

   const TABLES = [
     { model: db.projectRender, hasChecksum: false },
     { model: db.projectPhoto, hasChecksum: false },
     { model: db.unitRender, hasChecksum: false },
     { model: db.documentFile, hasChecksum: true },
   ] as const;

   for (const { model } of TABLES) {
     const rows = await (model as any).findMany({ where: { fileData: { not: null } } });
     for (const row of rows) {
       const blob = await put(`${row.id}-${row.name ?? "file"}`, row.fileData, {
         access: "public", // or "private" â decide per model; see 2.4
         contentType: row.fileMimeType ?? undefined,
       });
       await (model as any).update({
         where: { id: row.id },
         data: { fileUrl: blob.url },
       });
     }
   }
   ```
   Run the base64 `fileDataUrl` tables through the same pattern, decoding base64 â `Buffer` before `put()`.

2. **Verify before deleting**: for every migrated row, re-download the blob and compare its SHA-256 against `checksum` (or compute it fresh for tables that don't have one) before dropping the old column. Don't trust "the upload didn't throw" as proof of correctness.

3. **Drop the old columns** in a separate migration, only after verification passes on a full copy of production data â not the seed data.

4. **Update every read/write path.** These are the concrete files to touch (found by tracing `fileData`/`fileDataUrl` usage):
   - `src/app/api/documents/[id]/file/route.ts` â currently reads `doc.fileData` into a `Buffer` and serves it directly. Becomes a redirect (`NextResponse.redirect(doc.fileUrl)`) or a signed-URL fetch if the blob is private.
   - `src/app/api/documents/[id]/watermark/route.ts` â same pattern, check what it does with the raw bytes (likely needs to fetch the blob first if it's doing server-side image processing).
   - `src/app/api/project-photos/**`, `src/app/api/project-renders/**`, `src/app/api/unit-renders/**` â upload handlers; swap the write side to `put()` instead of writing to the `fileData` column.
   - `src/server/documents-module.ts`, `src/server/documents.ts` â anywhere these construct or return `fileData`.
   - Any component that displays a photo/render/drawing via an API route that streamed bytes â these can generally simplify to a plain `<img src={fileUrl}>`, since Blob URLs are directly servable. This is a net reduction in code, not just a swap.

### 2.4 One decision to make explicitly: public vs. private blobs

Site photos and renders are probably fine as public-but-unguessable URLs (Blob URLs include a random suffix). Contracts, legal documents, and payroll-adjacent documents in `DocumentFile` should not be â use Vercel Blob's private access + your existing `getCurrentUser()`/`can()` permission check to mint a short-lived signed URL per request, rather than a permanently public link. Don't apply one policy to everything without deciding this per model; that's where a "simple" migration accidentally creates a real data leak.

### 2.5 Acceptance criteria
- [ ] Zero rows anywhere in the schema with `Bytes` file content or base64 `fileDataUrl` text after migration.
- [ ] Every migrated file's blob checksum verified against its original before the old column is dropped.
- [ ] Contract/legal/payroll documents served via private, permission-checked signed URLs; photos/renders via public Blob URLs.
- [ ] `documentFile`/photo/render upload flows write directly to Blob, never buffering a full file into a database write.

---

## 3. Track C â CI pipeline

### 3.1 Target state

One GitHub Actions workflow, gating merges. Nothing fancier than what you already run locally â this is "make the existing scripts run automatically," not "build a deployment platform."

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
      AUTH_SECRET: ci-only-secret-do-not-use-in-prod
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

Notes:
- Uses a throwaway local Postgres container in CI, **not** a Neon branch â no reason to spend a real Neon branch-per-PR at this stage; that's a nice-to-have for later, not a Phase 0 requirement.
- This is also the first automated proof that Track A's Postgres migration actually works, since it runs the whole suite against real Postgres on every PR.
- Add branch protection on `main` requiring this workflow to pass, once it's green a few times.

### 3.2 Acceptance criteria
- [ ] `.github/workflows/ci.yml` runs typecheck, lint, unit tests, and e2e tests against Postgres on every PR.
- [ ] Branch protection requires it to pass before merge.
- [ ] A `.env.example` committed (currently missing) listing `DATABASE_URL`, `AUTH_SECRET`, and the Blob token, so CI and any future contributor aren't reverse-engineering required env vars from source.

---

## 4. Track D â Module file consolidation

### 4.1 Principle

Not every parallel file is a problem â some splits are deliberate and documented in code comments (e.g., `documents-module.ts` explicitly explains why it's separate from `documents.ts`). The rule for this track: **keep a split only if a comment in the code already justifies it with a real behavioral reason; merge everything else.**

### 4.2 Concrete audit list

| Files | Action |
|---|---|
| `src/server/documents.ts` + `src/server/documents-module.ts` | **Keep split** â comment explicitly states `documents.ts` is the per-record attachment API used by Projects/Tasks/Units, `documents-module.ts` is the folder-tree/Document-Passport layer. Different consumers, different lifecycle. Leave as-is, but add the same clarifying comment to the top of `documents.ts` (currently only the module file explains the split). |
| `src/server/finance.ts`, `finance-module.ts`, `finance-dashboard.ts`, `finance-budget.ts`, `finance-other.ts`, `finance-payroll.ts`, `finance-spendings.ts` | **Audit and likely consolidate.** Seven files for one domain, with no comment anywhere explaining the split (unlike the documents case). Read each file's actual exports; merge any pair whose split isn't load-bearing (e.g., `finance-other.ts` at 1.4KB is very likely better as a section inside `finance.ts`). Target: 3 files max â core CRUD, dashboard/read-aggregation, payroll (payroll is the one with a genuine reason to stay separate, given compliance sensitivity). |
| `src/server/contracts.ts` + `contracts-module.ts` | Same audit as finance â check for an explaining comment; if none exists, that's the signal to merge rather than a signal it's fine. |
| `src/server/procurement.ts` (31KB) + `procurement-comparison.ts` + `procurement-dashboard.ts` | Comparison and dashboard read-paths are plausibly fine to keep separate from the core module (read vs. write separation is a real reason) â verify, don't assume. |
| `src/lib/nav-config.ts` (45KB) and `src/lib/constants.ts` (30KB) | Not a split-file problem, but worth a pass: these are large enough that finding a specific constant is already friction. Consider splitting **by domain** (`constants/finance.ts`, `constants/hr.ts`, etc.) if either file keeps growing â not required in Phase 0, flagged for awareness. |

### 4.3 How to do this safely

For each merge candidate: move the code, keep git blame readable (`git mv` where the destination file doesn't already exist; otherwise a plain cut-paste plus a follow-up commit), update imports, run `npm run typecheck` â TypeScript will catch every broken import immediately, which is exactly why the project's explicit-argument tenant pattern (no magic re-exports) makes this refactor low-risk.

### 4.4 Acceptance criteria
- [ ] Every remaining multi-file split for one domain has a comment explaining why, or has been merged.
- [ ] Finance module reduced from 7 files to a justified, documented set (target 3).
- [ ] No behavior change â this track is pure refactor; the existing test suite (once running in CI per Track C) is the proof.

---

## 5. Sequencing

```
Track C (CI)  âââââââââââââââ
                             ââââº safety net for A, B, D
Track A (Postgres) ââââââââââ¼âââº must land before Track B's backfill script
                             â    is run against real prod data
Track D (file consolidation)â  (independent â do anytime, ideally first
                                since it's the cheapest and de-risks nothing else)

Track B (Blob storage) ââââââº depends on Track A being live in prod
                               (no point migrating files twice)
```

Recommended order: **D â C â A â B**. Consolidate files first (cheap, no risk), stand up CI second (so every subsequent change is checked automatically), confirm/fix the datasource third (foundational), migrate files last (depends on A, highest-stakes migration, benefits most from CI already being in place).

---

## 6. Definition of Done for Phase 0

- [ ] Production's actual datasource is known, documented, and matches `schema.prisma`.
- [ ] Postgres (Neon) is the live datasource, migration history is clean, full test suite passes against it.
- [ ] No binary or base64 file content remains in any database column; all served via Vercel Blob with an explicit public/private decision per model.
- [ ] CI runs typecheck + lint + unit + e2e on every PR and gates merges to `main`.
- [ ] Finance module (and any other undocumented split) consolidated to a justified file count.
- [ ] Zero new business features shipped during this phase.

## 7. What comes next (not in scope here)

Record-level permissions (contractor â own contract only), audit-log coverage verification, real notification delivery, and background jobs for long-running work (payroll runs, bulk imports). All of these are safer and faster to build once Phase 0's foundation â a real Postgres database, files out of the row data, and CI catching regressions â is in place.
