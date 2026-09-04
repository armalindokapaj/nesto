# Engineering response to NESTO-ARCH-PRD-001 v1.0

**Required by:** Master Architecture PRD, Appendix E
**Status:** Submitted 4 September 2026 — the Product Owner's answers of the same date are recorded in §1
**Scope:** the whole platform, Phase 0 through Phase 7

---

## 1. Mandate as accepted

The PRD was put to the Product Owner with the six material choices it does not settle by itself. The
answers below are binding and are the reason this response contains no optionality on those points.

| # | Question | Decision |
|---|---|---|
| 1 | Topology | **Full PRD topology, literal.** pnpm + Turborepo; `apps/company-web`, `apps/platform-admin`, `apps/api` (NestJS), `apps/worker`; `packages/*`; `domains/*`. |
| 2 | Schema path | **Greenfield.** Built from the PRD entity catalogue; the previous 275-model schema is not migrated. |
| 3 | Projects freeze | **Lifted.** Project Core is rebuilt per Phase 2. |
| 4 | PRD vs. incumbent decisions | **The PRD wins literally.** Decimal money, the PRD's 14 base roles, UUIDv7. |
| 5 | Existing application | **Clean slate in this repository.** `NestoWeb/` is removed; it survives only in git history. |
| 6 | Appendix E | **Produced before code.** This document. |
| 7 | Sequencing | **Phase 0 → 7 continuously**, reporting at phase boundaries without waiting for acceptance. |
| 8 | Infrastructure | **Local Docker only** (Postgres, Redis, MinIO, Mailpit); commit and push as phases land. No cloud provisioning. |
| 9 | Rendering | **Server-render with server-to-server API calls.** Next.js Server Components call the NestJS API over keep-alive; the browser never reaches the database and pays no round trip for first paint. |
| 10 | Branch | **origin/main directly**, accepting that the existing Vercel deployment breaks until the monorepo is deployable. |

---

## 2. Architecture validation

### 2.1 What the PRD gets right and this team is not going to relitigate

- **Modular monolith with hard logical seams.** The transaction spans in this product (contract activation,
  goods receipt, payment allocation, schedule apply) are genuinely multi-entity. Distributing them at the
  start would trade a solvable modelling problem for an unsolvable consistency problem. §5.5's extraction
  criteria are the right gate.
- **One authoritative owner per fact (§4.2).** This is the single most valuable constraint in the document.
  Nearly every defect class the PRD's threat model lists is a symptom of shared ownership.
- **No transitive access (§4.3).** Correct, and it is a *query-layer* rule, not a middleware rule; the
  design below puts it in the repository signature, not in a guard that can be forgotten.
- **Immutability of issued/posted/submitted records.** Reversal-not-edit is the only defensible model for
  finance and controlled documents.
- **Preview/apply for structural and schedule change.** Prevents the worst category of silent data damage.

### 2.2 Assumptions challenged

Each of these is a genuine engineering objection. None of them blocks the build; each is resolved below
and, where it changes anything, carries an ADR.

**C1 — The API hop taxes exactly the thing the Product Owner cares most about (speed).**
`§5.1` makes the NestJS API the authoritative transport and the Product Owner has chosen it literally.
An in-process call that took ~0.4 ms now costs a loopback HTTP round trip plus two JSON serialisations.
For a dashboard composing 12 widgets that is not free.
*Resolution, not exemption:* (a) Company Web renders on the server and calls the API over a persistent
keep-alive agent on the container network — the browser never makes the hop; (b) every page has a
**page-level query contract**: one composed endpoint per screen, not N widget endpoints, so the hop is
paid once; (c) an internal p95 budget of **≤ 120 ms API server time** for list endpoints, five times
stricter than §25.1's 500 ms, measured in CI against a seeded dataset; (d) `packages/contracts` exposes
the API client as the *only* transport, so if measurement later justifies an in-process binding for
company-web it is a one-file change behind the same contract. Recorded as ADR-0019.

**C2 — §5.3 lists 27 domains; §11.1 lists 22 database schemas.** These cannot both be one-to-one.
Left unresolved, every team invents its own mapping and the "no cross-schema write" rule becomes
unenforceable. The explicit mapping is in §4.2 of this document and is normative.

**C3 — Decimal money in a JavaScript runtime is a discipline problem, not a storage problem.**
`NUMERIC` in Postgres is exact; the risk is `Number(decimal)` somewhere in a serializer. Storage follows
the PRD. In addition, `packages/money` wraps every amount in a `Money` value object carrying its currency,
`Decimal.js` arithmetic and no implicit `valueOf`, and a lint rule bans arithmetic operators on
`Prisma.Decimal`. See ADR-0011.

**C4 — "Deny by default" is only true if the default path is the safe one.** A policy check that must be
*remembered* will eventually be forgotten. Every repository method therefore requires an
`ExecutionContext` as its first argument and every domain query builder injects the tenant/company/project
predicate — a query without scope does not compile. RLS is the second line, not the first. ADR-0002/0005.

**C5 — §9.1's `READ_ONLY_GRACE` (120 h) and `DELETION_ELIGIBLE` (365 d) are wall-clock states.**
They do not exist without a scheduler. The lifecycle queue and its idempotent transition jobs are Phase 1
scope, not an afterthought, and grace expiry must be enforced on read as well (a company whose grace
expired 3 seconds ago must not get one more write because the job has not run yet). Enforcement is
computed from `lockedAt`/`graceExpiresAt` at request time; the job only materialises the state.

**C6 — Search: the PRD permits "PostgreSQL first" and that is what this build uses.** OpenSearch for a
platform at this stage would add an operational component whose failure mode (stale ACLs in an index) is
exactly the leak class §26.2 forbids. Postgres `tsvector` + `pg_trgm`, with the revocation SLA enforced by
the same transaction that revokes access. The `SearchPort` interface keeps OpenSearch a swap. ADR-0009.

**C7 — §25.1's targets are ceilings, not budgets.** A 500 ms p95 read target permits a platform that feels
slow. Internal budgets (§9.2 below) are set materially tighter and enforced in CI.

**C8 — Malware scanning cannot be honestly claimed on a laptop.** The upload pipeline, quarantine
bucket, `FileObject` scan states and the "cannot publish before clean" rule are all built and tested. The
*scanner* is a driver: `clamav` for real deployments, `permissive-dev` locally, which marks files clean and
is refused at boot when `NODE_ENV=production`. This is a declared deviation (§11, D-3), not a silent one.

**C9 — External participants are not base roles.** §8.2's 14 roles contain no CLIENT or CONTRACTOR, and
correctly so: an external participant is not a company member. They are a `User` with an
`ExternalRelationshipMembership` under an `ExternalAccessScope`, in the `EXTERNAL_PORTAL` audience. Any
attempt to model them as a company role reintroduces exactly the transitive-access defect §4.3 forbids.

**C10 — "One accountable owner after READY" needs a database constraint, not a service rule.** Modelled as
a nullable `ownerMembershipId` on `WorkItem` with a `CHECK (lifecycle_status = 'DRAFT' OR owner_membership_id IS NOT NULL)`.

---

## 3. Domain and ownership map

### 3.1 Bounded contexts and their authority

| Domain | Owns (authoritative) | Never owns |
|---|---|---|
| `foundation` | Tenant, BusinessGroup, Company, CompanyRelationship, Branch, CompanyCommercial, CompanySettings, LegalDocumentVersion, LegalAcceptance, FeatureAssignment | Any business record |
| `identity` | User, Credential, Session, MfaMethod, RecoveryCode, SecurityStamp, Invitation, OnboardingProgress | Role meaning, employment |
| `authorization` | PermissionGrant, policy evaluation, permission manifest, role matrix | Membership rows |
| `organization` | CompanyMembership, Department, org chart edges | Employment terms (HR), permissions |
| `projects` | Project, ProjectMembership, ProjectTemplateSnapshot, ProvisioningStep, TemplateFamily/Version/Variation | Plan structure, work |
| `project-core` | PhysicalNode, WbsNode, PhysicalWbsLink, ProjectPlanState, ProjectCalendar, WorkDependency, SchedulePreview, Baseline | Task state |
| `tasks` | WorkItem, contributors, watchers, ChecklistItem, SavedView | Tree structure, schedule apply |
| `documents` | FileObject, Document, DocumentRevision, status history, distribution, shortcuts, links, Transmittal | Business meaning of a document |
| `design-control` | Rfi, Submittal, DesignChange, Variation | Contract value, schedule dates |
| `contracts` | Contract, ContractVersion, ContractParty, ContractFinancialSummary | Money truth (Finance) |
| `finance` | Budget/Line, Commitment, Invoice/Line, Payment, PaymentAllocation, Retention, AdvancePayment, Forecast, CostCode | Order, stock, contract legal state |
| `procurement` | PurchaseRequisition, Rfq, Quotation, PurchaseOrder/Line, Delivery, AwardRecommendation | Goods receipt, stock, invoice |
| `inventory` | Warehouse, StockItem, GoodsReceipt, StockMovement, derived balances | Commitment, price truth |
| `site-operations` | DailySiteReport, DailyWorkforceEntry, EquipmentUsage, MaterialConsumption, Asset, MaintenanceRecord | Progress certification |
| `work-progress` | ProgressMeasurement, certification, rollups, Boq/BoqItem | Quality acceptance |
| `qaqc` | InspectionRequest, Inspection, CorrectiveAction, HandoverPackage | Physical progress |
| `hse` | HseIncident, HseInspection, ToolboxTalk, HSE corrective actions | Task ownership |
| `hr` | Employee, employment, salary, leave, attendance, certifications, TalentPoolEntry | Login identity, permissions |
| `crm` | Lead, Opportunity, Proposal, Client, Unit | Contract, invoice, payment |
| `network` | CompanyPublicProfile, CompanyVerification, VerifiedProjectExperience, CompanyConnection, ProjectInvitation, ExternalAccessScope, ExternalAction, FormalCorrespondence, ProfessionalProfile/Connection, DirectMessageThread | Any private ERP record |
| `jobs` | JobPost, JobApplication | Employee creation |
| `tenders` | Tender, TenderRound, TenderBid, BidClarificationThread, TenderDecision | PO/contract creation |
| `portals` | External projections, portal sessions, external submissions | Internal records |
| `workflow` | WorkflowDefinition/Version/Instance/WorkItem, ApprovalDecision | Business finalization |
| `notifications` | Notification, DeliveryAttempt, preferences, digests | Business state |
| `search` | SearchDocumentState, index | Any source record |
| `reporting` | MetricDefinition, ReportDefinition, ReportRun, read models | Any source record |

### 3.2 Domain → database schema mapping (resolves C2, normative)

| Postgres schema | Domains writing it |
|---|---|
| `foundation` | foundation |
| `identity` | identity |
| `authorization` | authorization |
| `organization` | organization |
| `projects` | projects |
| `project_core` | project-core |
| `tasks` | tasks |
| `documents` | documents, design-control |
| `contracts` | contracts |
| `finance` | finance |
| `procurement` | procurement |
| `inventory` | inventory |
| `site` | site-operations, work-progress |
| `quality` | qaqc |
| `hse` | hse |
| `hr` | hr, jobs (JobApplication/TalentPool are HR-private) |
| `crm` | crm |
| `network` | network, tenders, portals |
| `workflow` | workflow |
| `notifications` | notifications |
| `integration` | outbox, inbox, checkpoints, dead letters, imports/exports, search state, reporting read models |
| `audit` | audit, activity |

`jobs`, `tenders` and `portals` share a schema with their closest owner because their aggregates are
transactionally coupled to it (a bid belongs to a tender belongs to a network relationship). The
*domain* boundary and its repository still holds; only the physical schema is shared, and the shared
schema's tables remain single-owner at table granularity.

### 3.3 Dependency direction

`foundation` ← `identity` ← `authorization` ← `organization` ← everything else.
No domain imports a peer's repository. Cross-domain reads go through a published query contract in
`packages/contracts`; cross-domain writes go through the owner's application service or an event.
An architecture test (`packages/testing/architecture.test.ts`) fails the build on any violation.

---

## 4. Physical schema and migration plan, Phases 0–2

### 4.1 Approach

Prisma with `multiSchema` and `prismaSchemaFolder`: one `.prisma` file per domain under
`packages/database/prisma/schema/`, each declaring `@@schema("<domain>")`. One generated client, many
schemas — which matches the modular monolith exactly: separate ownership, one connection pool.

Greenfield means there is no data migration. There is a **provisioning migration**: `00000000_init` creates
the schemas, roles and RLS policies before the first table migration runs.

### 4.2 Migration streams

| Order | Migration | Contents |
|---|---|---|
| 0 | `init_schemas_roles_rls` | 22 schemas, `app_owner`/`app_runtime` roles, `app.tenant_id`/`app.company_id` GUC helpers, RLS enable function |
| 1 | `foundation` | Tenant, BusinessGroup, Company (+lifecycle), CompanyRelationship, Branch, CompanyCommercial, CompanySettings, LegalDocumentVersion, LegalAcceptance, FeatureAssignment |
| 2 | `identity` | User, Credential, Session, MfaMethod, RecoveryCode, SecurityStamp, Invitation, OnboardingProgress |
| 3 | `authorization` | PermissionGrant |
| 4 | `organization` | Department, CompanyMembership |
| 5 | `audit` + `integration` | AuditEvent (append-only grants + hash chain), ActivityEvent, OutboxEvent, InboxMessage, ConsumerCheckpoint, DeadLetter, ImportJob, ExportJob, IdempotencyKey |
| 6 | `notifications` | Notification, DeliveryAttempt, preferences |
| 7 | `projects` | TemplateFamily/Version/Variation, Project, ProjectTemplateSnapshot, ProvisioningStep, ProjectMembership |
| 8 | `project_core` | ProjectPlanState, PhysicalNode, WbsNode, PhysicalWbsLink, ProjectCalendar, WorkDependency, SchedulePreview, Baseline |
| 9 | `tasks` | WorkItem, WorkItemContributor, WorkItemWatcher, ChecklistItem, SavedView |
| 10 | `documents` | FileObject, Document, DocumentRevision, history, distribution, shortcut, link, Transmittal |

Phases 3–7 add their own streams in the same manner. Every migration is reviewed for the §11.8 index
baseline and carries expected cardinality in its header comment.

### 4.3 Shared column contract

Enforced by a generated Prisma fragment and asserted by a schema test over `information_schema`:

```
id             uuid PRIMARY KEY            -- UUIDv7, application-generated
tenant_id      uuid NOT NULL               -- every tenant-owned table
owning_company_id uuid NOT NULL            -- every company-owned table
project_id     uuid                        -- NOT NULL on project-scoped tables
code           text                        -- scoped human code, never a key
lifecycle_status text NOT NULL
record_version integer NOT NULL DEFAULT 1
confidentiality text
created_at     timestamptz NOT NULL
created_by     uuid NOT NULL
updated_at     timestamptz NOT NULL
updated_by     uuid NOT NULL
archived_at    timestamptz
archived_by    uuid
source_system  text
import_batch_id uuid
```

### 4.4 RLS

Every tenant table gets `ENABLE ROW LEVEL SECURITY` and a policy
`USING (tenant_id = current_setting('app.tenant_id', true)::uuid)`. The setting is applied with
`SET LOCAL` inside the transaction opened by the request's unit of work, never on a pooled session
(§6.3). A repository test asserts that a query issued without the GUC returns zero rows.

---

## 5. API and event contract draft

### 5.1 API shape

`packages/contracts` holds Zod schemas as the single source; NestJS DTOs and the generated TypeScript
client are both derived from them, so a DTO cannot drift from its client. `/api/v1`, envelopes exactly as
§19.2/§19.3, `Idempotency-Key` on every retryable mutation, `If-Match` on every versioned update.

Composed page endpoints (C1) live under `/api/v1/views/*` and are read-only compositions with their own
permission contract — they never become a write path.

### 5.2 Event contract

The envelope of §20.1 verbatim, with the payload typed per event in `packages/events`, a JSON-Schema
registry under `docs/events/`, and a CI check that a published event type/version never changes meaning.

Outbox: `integration.outbox_event` written in the business transaction; a BullMQ relay publishes
at-least-once; `integration.inbox_message` deduplicates by `(consumer, event_id)`;
`integration.consumer_checkpoint` records progress; failures land in `integration.dead_letter`.

### 5.3 Queues

`provisioning`, `lifecycle`, `notifications`, `files`, `data-transfer`, `structure`, `schedule`,
`search`, `reporting`, `reconciliation`, `retention`, `integration` — each with context-carrying,
idempotent payloads per §20.8.

---

## 6. Threat model and tenant-isolation design

Full document: `docs/threat-models/`. Summary of controls against §24.1:

| Threat | Primary control | Secondary |
|---|---|---|
| Cross-tenant read/write | Scoped repositories requiring ExecutionContext | Postgres RLS |
| Cross-tenant reference on write | Every related ID re-resolved in context before write | Compound FKs including tenant |
| Stale-session privilege | SecurityStamp compared on every request; membership read live | Short access token (10 min) |
| Admin → Owner escalation | Owner mutations gated on `actor.isOwner`; single-Owner DB constraint | Recent-auth + audit |
| IDOR on public/external | Opaque external resource IDs; scope revalidated per request | Non-disclosing 404 |
| Unauthorized approval | Approval right resolved from the WorkItem, never the request | Audit + workflow version pin |
| Finance/HR field leak | Field-set selected before query; prohibited columns never loaded | Export policy ≥ view policy |
| Signed-URL leakage | Short expiry, per-download authorization, random keys | Revocation invalidates |
| Malicious upload | Quarantine bucket, content-sniffed MIME, scan gate | CSV formula-injection escaping |
| Invitation/recovery takeover | Hashed single-use tokens, generic responses, rate limits | Session revocation on success |
| Event/job scope confusion | Scope in every payload; consumer re-establishes context | Inbox dedupe |
| Audit tampering | No UPDATE/DELETE grant on audit schema | Per-tenant hash chain |

---

## 7. CI/CD and environments

**Local:** `docker compose up` → Postgres 17, Redis 7, MinIO, Mailpit. `pnpm dev` runs api, worker,
company-web and platform-admin under Turborepo.

**CI (GitHub Actions):** typecheck → lint → architecture tests → unit → repository/integration against a
real Postgres service → OpenAPI breaking-change check → event-schema check → isolation suite → e2e →
build. Secret scan, dependency audit and SAST run in the same workflow.

**Environments:** local and CI only in this engagement. Staging/production remain a separate task the
Product Owner drives (deviation D-1).

---

## 8. Test strategy and release gates

Layers exactly as §26.1. The two that carry the most weight here:

- **The isolation suite (§26.2)** is generated, not hand-written: a table-driven harness enumerates every
  registered aggregate and asserts the ten isolation properties against it. A new aggregate that is not
  registered fails the build, so coverage cannot silently rot.
- **The concurrency harness** exercises `recordVersion`, `structureRevision`, `graphRevision`, preview
  tokens and idempotency keys under parallel writers.

Release gates per §27.1, evaluated at each phase boundary and reported; the build does not stop for
acceptance (decision 7).

---

## 9. Estimates, risks, performance budgets

### 9.1 Phase sizing

Sizing is in engineering-days for a conventional team, given for planning honesty; this build executes
them sequentially and continuously.

| Phase | Content | Est. |
|---|---|---|
| 0 | Monorepo, CI, DB/RLS/roles, outbox, audit, storage, isolation + concurrency harness | 20 d |
| 1 | Platform Foundation: identity, MFA, sessions, policy engine, lifecycle, legal, org, onboarding, templates, provisioning, notifications, i18n | 45 d |
| 2 | Project Core: lifecycle, physical tree, WBS, work items, dependencies, calendars, schedule preview/apply, rollups, health, baselines, saved views, import/export | 45 d |
| 3 | Documents/revisions/transmittals, RFI, submittals, design changes, variations, site reports, QA/QC, HSE | 40 d |
| 4 | BOQ, cost codes, budgets, contracts, procurement, inventory, finance, reconciliation | 50 d |
| 5 | CRM/Sales/Clients/Units, HR, assets, work progress, handover, portals, correspondence | 45 d |
| 6 | Network: profiles, verification, discovery, connections, invitations, scopes, professional network, jobs, talent, tenders | 40 d |
| 7 | Reporting depth, JV scope, BIM links, adapters, scale work | 25 d |

### 9.2 Performance budgets (internal, stricter than §25.1)

| Operation | Budget (API server time) |
|---|---|
| Indexed list endpoint, p95 | ≤ 120 ms |
| Composed page view endpoint, p95 | ≤ 200 ms |
| Single-record read, p95 | ≤ 60 ms |
| Ordinary mutation, p95 | ≤ 250 ms |
| Company Web TTFB (SSR incl. API hop), p95 | ≤ 350 ms |
| Tree render, 5 000 nodes | ≤ 1 s to interactive, virtualized |

Enforced by a benchmark job against seeded data; a regression beyond budget fails CI.

### 9.3 Principal risks

| Risk | Impact | Mitigation |
|---|---|---|
| API hop erodes perceived speed | High | Page-level composed endpoints, keep-alive, strict budgets, contract-level swap to in-process (ADR-0019) |
| Breadth of Phases 3–6 | High | Each domain ships production-shaped with its own tests; no placeholder models (§27 preamble) |
| Decimal misuse in JS | High | `Money` value object + lint rule + property tests |
| RLS + pooling misuse | High | `SET LOCAL` only, asserted by a repository test |
| Scanner unavailable locally | Medium | Driver pattern, production boot refuses the dev driver (D-3) |
| Scope drift into deferred items (Appendix G) | Medium | Extension points only; no user-visible behavior |

---

## 10. Operational cost and scaling assumptions

Single EU region, one Postgres primary with a read replica, Redis, S3-compatible storage, two API
replicas, one worker replica, two Next.js replicas. The design scales first by (a) read models for
dashboard/report load, (b) worker replicas per queue, (c) a Postgres read replica for reporting, and
only then by extracting a domain under §5.5's criteria. Partitioning candidates (§11.9) — audit,
activity, outbox, notification delivery, site events — are the first things to partition by time.

No cost estimate is offered for infrastructure that has not been selected; hosting selection is D-1.

---

## 11. Explicit deviations from the PRD

Per Appendix E, each is a proposal until accepted, and each is recorded as an ADR.

| ID | Deviation | Reason | ADR |
|---|---|---|---|
| D-1 | No staging/production environment provisioned; EU hosting, CDN/WAF, managed secrets and penetration testing are not performed | Product Owner decision 8: local Docker only | ADR-0015 |
| D-2 | Search is PostgreSQL (`tsvector`/`pg_trgm`), not OpenSearch | Explicitly permitted by §5.1; avoids an ACL-staleness leak surface | ADR-0009 |
| D-3 | Malware scanning uses a driver; locally `permissive-dev` marks files clean. Production boot refuses it | No scanner on the build machine; the pipeline, states and gate are real | ADR-0007 |
| D-4 | Email delivery uses Mailpit locally; provider adapters are interfaces only | No provider credentials; §20.9 lists them as deferred adapters anyway | ADR-0015 |
| D-5 | OpenTelemetry is instrumented with an OTLP exporter that is off by default locally | No collector to export to | ADR-0015 |
| D-6 | Reporting warehouse deferred to Phase 7; Phases 1–6 use Postgres read models | Matches §22.2's own staging and avoids premature infrastructure | ADR-0010 |
| D-7 | Per-domain database roles are created and granted, but local development connects as one owner role | A 22-role connection matrix on a laptop buys nothing; the grants and the RLS are real and CI asserts them | ADR-0002 |
| D-8 | Composed page-view endpoints (`/api/v1/views/*`) are added to the API surface of §19.6 | Required to keep the mandated API hop within the speed target (C1) | ADR-0019 |

Everything else in the PRD is implemented as written.
