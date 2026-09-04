/**
 * The event registry — PRD §20.2, §20.7.
 *
 * A published `(type, version)` pair's meaning is immutable. Adding an optional
 * field to an existing version is allowed; anything else is a new version. This
 * registry is what CI diffs to enforce that, and what the relay consults to
 * decide whether an incoming version is supported at all — an unsupported one
 * dead-letters rather than being silently ignored (§20.2).
 */

import { z } from "zod";

export type EventRegistration = {
  type: string;
  version: number;
  producer: string;
  aggregateType: string;
  /** Payload schema. Kept minimal on purpose: §20.1 forbids shipping
   *  confidential snapshots inside events. */
  schema: z.ZodTypeAny;
  description: string;
};

const uuid = z.string().uuid();

/**
 * The §20.7 baseline catalogue. Domains register their own events by calling
 * `registerEvent` at module load; these are declared centrally because they are
 * the platform's published contract and reviewers should see them in one place.
 */
const registry = new Map<string, EventRegistration>();

export function registerEvent(reg: EventRegistration): EventRegistration {
  const key = `${reg.type}`;
  const existing = registry.get(key);
  if (existing && existing.producer !== reg.producer) {
    throw new Error(`Event ${key} is already produced by ${existing.producer}; two producers is an ownership violation.`);
  }
  registry.set(key, reg);
  return reg;
}

export function getEvent(type: string): EventRegistration | undefined {
  return registry.get(type);
}

export function allEvents(): EventRegistration[] {
  return [...registry.values()].sort((a, b) => a.type.localeCompare(b.type));
}

export function isSupported(type: string): boolean {
  return registry.has(type);
}

// ---------------------------------------------------------------------------
// Baseline catalogue (§20.7). Payloads carry identifiers and state codes — the
// facts a consumer needs to decide whether to act — never record contents.
// ---------------------------------------------------------------------------

const stateChange = z.object({ from: z.string(), to: z.string(), reason: z.string().optional() });

export const CompanyLifecycleChanged = registerEvent({
  type: "company.lifecycle.changed.v1", version: 1, producer: "foundation", aggregateType: "COMPANY",
  schema: stateChange.extend({ companyId: uuid, effectiveAt: z.string().datetime(), graceExpiresAt: z.string().datetime().nullable().optional() }),
  description: "A company moved between the protected lifecycle states of §9.1.",
});

export const CompanyVerificationChanged = registerEvent({
  type: "company.verification.changed.v1", version: 1, producer: "network", aggregateType: "COMPANY_VERIFICATION",
  schema: stateChange.extend({ companyId: uuid }),
  description: "A company's public verification status changed (§15.2).",
});

export const MembershipChanged = registerEvent({
  type: "membership.changed.v1", version: 1, producer: "organization", aggregateType: "COMPANY_MEMBERSHIP",
  schema: z.object({ membershipId: uuid, userId: uuid, companyId: uuid, role: z.string(), status: z.string(), previousRole: z.string().nullable().optional() }),
  description: "A company membership's role or status changed. Consumers must treat this as an authority change and invalidate derived access.",
});

export const PermissionChanged = registerEvent({
  type: "permission.changed.v1", version: 1, producer: "authorization", aggregateType: "PERMISSION_GRANT",
  schema: z.object({ subjectType: z.enum(["MEMBERSHIP", "PROJECT_MEMBERSHIP", "EXTERNAL_SCOPE"]), subjectId: uuid, effect: z.enum(["ALLOW", "DENY", "REVOKED"]), permissionKey: z.string() }),
  description: "An explicit grant or deny changed. Triggers revocation propagation (§25.1).",
});

export const ProjectStateChanged = registerEvent({
  type: "project.state.changed.v1", version: 1, producer: "projects", aggregateType: "PROJECT",
  schema: stateChange.extend({ projectId: uuid }),
  description: "A project moved between the states of §12.2.",
});

export const ProjectMemberChanged = registerEvent({
  type: "project.member.changed.v1", version: 1, producer: "projects", aggregateType: "PROJECT_MEMBERSHIP",
  schema: z.object({ projectId: uuid, membershipId: uuid, projectRole: z.string(), status: z.string() }),
  description: "Project participation changed. Note that participation is not access (§8.3).",
});

export const PhysicalStructureChanged = registerEvent({
  type: "physical.structure.changed.v1", version: 1, producer: "project_core", aggregateType: "PHYSICAL_TREE",
  schema: z.object({ projectId: uuid, structureRevision: z.number().int(), changeKind: z.enum(["CREATE", "UPDATE", "MOVE", "ARCHIVE", "RENUMBER", "IMPORT"]), affectedNodeIds: z.array(uuid) }),
  description: "The physical hierarchy changed; carries the new structure revision (ADR-0012).",
});

export const WbsStructureChanged = registerEvent({
  type: "wbs.structure.changed.v1", version: 1, producer: "project_core", aggregateType: "WBS_TREE",
  schema: z.object({ projectId: uuid, wbsRevision: z.number().int(), changeKind: z.enum(["CREATE", "UPDATE", "MOVE", "ARCHIVE", "RENUMBER", "IMPORT"]), affectedNodeIds: z.array(uuid) }),
  description: "The WBS changed; carries the new WBS revision.",
});

export const WorkItemChanged = registerEvent({
  type: "work_item.changed.v1", version: 1, producer: "tasks", aggregateType: "WORK_ITEM",
  schema: z.object({ workItemId: uuid, projectId: uuid, changedFields: z.array(z.string()) }),
  description: "A work item's attributes changed. Field names only — not values.",
});

export const WorkItemStatusChanged = registerEvent({
  type: "work_item.status.changed.v1", version: 1, producer: "tasks", aggregateType: "WORK_ITEM",
  schema: stateChange.extend({ workItemId: uuid, projectId: uuid, ownerMembershipId: uuid.nullable() }),
  description: "A work item moved between the states of §12.6.",
});

export const ScheduleApplied = registerEvent({
  type: "schedule.applied.v1", version: 1, producer: "project_core", aggregateType: "PROJECT_PLAN",
  schema: z.object({ projectId: uuid, previewId: uuid, graphRevision: z.number().int(), movedWorkItemIds: z.array(uuid) }),
  description: "An assisted schedule preview was applied. Dates never move without one (§12.7).",
});

export const BaselineCompleted = registerEvent({
  type: "baseline.completed.v1", version: 1, producer: "project_core", aggregateType: "BASELINE",
  schema: z.object({ projectId: uuid, baselineId: uuid, isPrimary: z.boolean(), capturedRevisions: z.record(z.number().int()) }),
  description: "An immutable plan snapshot was captured.",
});

export const DocumentRevisionIssued = registerEvent({
  type: "document.revision.issued.v1", version: 1, producer: "documents", aggregateType: "DOCUMENT_REVISION",
  schema: z.object({ documentId: uuid, revisionId: uuid, revisionCode: z.string(), supersededRevisionId: uuid.nullable().optional() }),
  description: "A controlled revision was issued. Issued revisions are immutable (§13.1).",
});

export const RfiOpened = registerEvent({
  type: "rfi.opened.v1", version: 1, producer: "design_control", aggregateType: "RFI",
  schema: z.object({ rfiId: uuid, projectId: uuid, responsiblePartyId: uuid.nullable(), dueDate: z.string().nullable().optional() }),
  description: "An RFI was formally opened.",
});

export const RfiResponded = registerEvent({
  type: "rfi.responded.v1", version: 1, producer: "design_control", aggregateType: "RFI",
  schema: z.object({ rfiId: uuid, projectId: uuid, responseId: uuid }),
  description: "A formal RFI response was submitted. Responses are immutable once submitted (§13.2).",
});

export const SubmittalDecisionRecorded = registerEvent({
  type: "submittal.decision.recorded.v1", version: 1, producer: "design_control", aggregateType: "SUBMITTAL",
  schema: z.object({ submittalId: uuid, projectId: uuid, roundNumber: z.number().int(), decision: z.string() }),
  description: "A submittal round received a review decision (§13.3).",
});

export const VariationStateChanged = registerEvent({
  type: "variation.state.changed.v1", version: 1, producer: "design_control", aggregateType: "VARIATION",
  schema: stateChange.extend({ variationId: uuid, projectId: uuid }),
  description: "A variation changed state. Downstream domains finalize their own consequences (§13.4).",
});

export const ContractActivated = registerEvent({
  type: "contract.activated.v1", version: 1, producer: "contracts", aggregateType: "CONTRACT",
  schema: z.object({ contractId: uuid, contractVersionId: uuid, effectiveFrom: z.string() }),
  description: "A contract became active against an exact approved version. It creates no PO, invoice or payment (§14.3).",
});

export const BudgetApproved = registerEvent({
  type: "budget.approved.v1", version: 1, producer: "finance", aggregateType: "BUDGET",
  schema: z.object({ budgetId: uuid, projectId: uuid.nullable(), revisionNumber: z.number().int(), currency: z.string().length(3) }),
  description: "A budget or budget revision was approved.",
});

export const InvoicePosted = registerEvent({
  type: "invoice.posted.v1", version: 1, producer: "finance", aggregateType: "INVOICE",
  schema: z.object({ invoiceId: uuid, direction: z.enum(["PAYABLE", "RECEIVABLE"]), currency: z.string().length(3), postingDate: z.string() }),
  description: "An invoice was posted and is now immutable; correction is by reversal (§14.2).",
});

export const PaymentPosted = registerEvent({
  type: "payment.posted.v1", version: 1, producer: "finance", aggregateType: "PAYMENT",
  schema: z.object({ paymentId: uuid, direction: z.enum(["OUTGOING", "INCOMING"]), currency: z.string().length(3), postingDate: z.string() }),
  description: "A payment was posted.",
});

export const PurchaseOrderIssued = registerEvent({
  type: "purchase_order.issued.v1", version: 1, producer: "procurement", aggregateType: "PURCHASE_ORDER",
  schema: z.object({ purchaseOrderId: uuid, supplierId: uuid, currency: z.string().length(3) }),
  description: "A purchase order was issued and became a commitment.",
});

export const GoodsReceiptPosted = registerEvent({
  type: "goods_receipt.posted.v1", version: 1, producer: "inventory", aggregateType: "GOODS_RECEIPT",
  schema: z.object({ goodsReceiptId: uuid, purchaseOrderId: uuid.nullable(), warehouseId: uuid }),
  description: "Received quantity was accepted into stock.",
});

export const StockMovementPosted = registerEvent({
  type: "stock.movement.posted.v1", version: 1, producer: "inventory", aggregateType: "STOCK_MOVEMENT",
  schema: z.object({ movementId: uuid, kind: z.enum(["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"]), warehouseId: uuid }),
  description: "An immutable stock movement was posted. Balances are derived from these, never edited (§13.10).",
});

export const ProgressMeasurementApproved = registerEvent({
  type: "progress.measurement.approved.v1", version: 1, producer: "work_progress", aggregateType: "PROGRESS_MEASUREMENT",
  schema: z.object({ measurementId: uuid, projectId: uuid, wbsNodeId: uuid }),
  description: "Measured physical work was certified. Certification is an explicit workflow, not a side effect of a daily report (§13.6).",
});

export const InspectionCompleted = registerEvent({
  type: "inspection.completed.v1", version: 1, producer: "qaqc", aggregateType: "INSPECTION",
  schema: z.object({ inspectionId: uuid, projectId: uuid, result: z.enum(["PASSED", "FAILED"]) }),
  description: "A quality inspection concluded. Physical completion does not imply this (§13.7).",
});

export const HseIncidentReported = registerEvent({
  type: "hse.incident.reported.v1", version: 1, producer: "hse", aggregateType: "HSE_INCIDENT",
  schema: z.object({ incidentId: uuid, projectId: uuid.nullable(), classification: z.string(), severity: z.string() }),
  description: "A safety event was reported. Sensitive detail stays in restricted fields, never in this payload.",
});

export const ExternalScopeChanged = registerEvent({
  type: "external.scope.changed.v1", version: 1, producer: "network", aggregateType: "EXTERNAL_ACCESS_SCOPE",
  schema: z.object({ scopeId: uuid, projectId: uuid, externalCompanyId: uuid, state: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]) }),
  description: "External access was granted, revoked or expired. Revocation must reach sessions, projections, caches, search and files (§18.3).",
});

export const CorrespondenceSent = registerEvent({
  type: "correspondence.sent.v1", version: 1, producer: "network", aggregateType: "FORMAL_CORRESPONDENCE",
  schema: z.object({ correspondenceId: uuid, kind: z.string(), senderCompanyId: uuid, recipientCompanyId: uuid, projectId: uuid.nullable().optional() }),
  description: "Formal correspondence was sent and is now immutable (§15.7).",
});

export const JobApplicationStageChanged = registerEvent({
  type: "job.application.stage.changed.v1", version: 1, producer: "jobs", aggregateType: "JOB_APPLICATION",
  schema: stateChange.extend({ applicationId: uuid, jobPostId: uuid }),
  description: "An application moved stage. Reaching HIRED creates no user, membership or employee (§16.3).",
});

export const TenderBidSubmitted = registerEvent({
  type: "tender.bid.submitted.v1", version: 1, producer: "tenders", aggregateType: "TENDER_BID",
  schema: z.object({ bidId: uuid, tenderId: uuid, roundId: uuid, bidderCompanyId: uuid }),
  description: "A bid was submitted and frozen. No amount travels in this event — competitors must not learn one from a projection.",
});

export const TenderPreferredBidderApproved = registerEvent({
  type: "tender.preferred_bidder.approved.v1", version: 1, producer: "tenders", aggregateType: "TENDER_DECISION",
  schema: z.object({ tenderId: uuid, decisionId: uuid, preferredBidderCompanyId: uuid, approvedBy: uuid }),
  description: "Central approval of a preferred bidder completed. Creates no PO or contract (§17.5).",
});

export const WorkflowOutcomeReached = registerEvent({
  type: "workflow.outcome.reached.v1", version: 1, producer: "workflow", aggregateType: "WORKFLOW_INSTANCE",
  schema: z.object({ instanceId: uuid, sourceType: z.string(), sourceId: uuid, sourceRecordVersion: z.number().int(), outcome: z.enum(["APPROVED", "REJECTED", "CANCELLED"]) }),
  description: "A workflow reached an outcome. NO business state has changed yet — the source finalizes and confirms (ADR-0013).",
});
