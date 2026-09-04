/**
 * Company lifecycle operations — PRD §9.2, §9.3.
 *
 * Only Platform Admin reaches these. Each one follows §8.7's contract: resolve
 * context, evaluate permission before loading, load through a scoped
 * repository, apply the state machine, write with audit and outbox atomically.
 *
 * Every transition here is a **guarded conditional update**: the legal source
 * states are part of the WHERE clause. Two administrators clicking Suspend at
 * the same instant produce one suspension and one clear error, rather than two
 * suspensions with two different grace expiries.
 */

import { NestoError, forbidden, notFoundInScope, type ExecutionContext } from "@nesto/contracts";
import { readScope, unitOfWork, type TransactionalDb } from "@nesto/database";
import { evaluate, type PolicySubject } from "@nesto/policy";
import {
  canTransition, deletionEligibleFrom, effectiveState, graceExpiryFrom,
  reactivationTarget, type CompanyState, type LifecycleFacts,
} from "./lifecycle";

const LIFECYCLE_FIELDS = {
  id: true, tenantId: true, legalName: true, displayName: true, slug: true,
  lifecycleStatus: true, graceExpiresAt: true, lockedAt: true,
  deletionEligibleAt: true, onboardingCompletedAt: true, recordVersion: true,
} as const;

export type CompanyLifecycleView = {
  id: string;
  displayName: string;
  storedStatus: string;
  effectiveStatus: CompanyState;
  graceExpiresAt: Date | null;
  lockedAt: Date | null;
  deletionEligibleAt: Date | null;
  recordVersion: number;
};

function toView(row: LifecycleFacts & { id: string; displayName: string; recordVersion: number }, now: Date): CompanyLifecycleView {
  return {
    id: row.id,
    displayName: row.displayName,
    storedStatus: row.lifecycleStatus,
    // Stored and effective are both surfaced: a Platform Admin needs to see
    // that a company is *effectively* locked even though the row still says
    // grace, or the screen and the API disagree.
    effectiveStatus: effectiveState(row, now),
    graceExpiresAt: row.graceExpiresAt,
    lockedAt: row.lockedAt,
    deletionEligibleAt: row.deletionEligibleAt,
    recordVersion: row.recordVersion,
  };
}

export async function getCompanyLifecycle(subject: PolicySubject, companyId: string): Promise<CompanyLifecycleView> {
  const decision = evaluate(subject, "platform.company.read");
  if (!decision.allow) throw forbidden("platform.company.read", decision.reasons.join(","));

  const row = await readScope(subject.ctx, (tx) =>
    tx.company.findFirst({ where: { id: companyId }, select: LIFECYCLE_FIELDS })
  );
  if (!row) throw notFoundInScope("Company", `company ${companyId} not visible in this scope`);
  return toView(row, new Date(subject.ctx.now));
}

/**
 * Suspend. Normal suspension opens a 120-hour read-only grace; a documented
 * security incident locks immediately (§9.2).
 */
export async function suspendCompany(
  subject: PolicySubject,
  params: { companyId: string; reason: string; immediateLock?: boolean }
): Promise<CompanyLifecycleView> {
  const decision = evaluate(subject, "platform.company.suspend", { mutating: true });
  if (!decision.allow) throw forbidden("platform.company.suspend", decision.reasons.join(","));
  if (!params.reason.trim()) {
    throw new NestoError("VALIDATION_FAILED", "A suspension needs a reason; it becomes part of the audit record.");
  }

  const now = new Date(subject.ctx.now);
  const target: CompanyState = params.immediateLock ? "LOCKED" : "READ_ONLY_GRACE";

  return unitOfWork(subject.ctx, async (uow) => {
    const before = await loadForTransition(uow.tx, params.companyId, now);
    assertTransition(before.effectiveStatus, target);

    const data = params.immediateLock
      ? {
          lifecycleStatus: "LOCKED",
          suspendedAt: now,
          lockedAt: now,
          graceExpiresAt: null,
          deletionEligibleAt: deletionEligibleFrom(now),
          lifecycleReason: params.reason,
        }
      : {
          lifecycleStatus: "READ_ONLY_GRACE",
          suspendedAt: now,
          graceExpiresAt: graceExpiryFrom(now),
          lifecycleReason: params.reason,
        };

    const updated = await guardedTransition(uow.tx, params.companyId, before, data);

    uow.audit({
      action: params.immediateLock ? "company.locked" : "company.suspended",
      tenantId: before.tenantId, owningCompanyId: params.companyId,
      targetType: "COMPANY", targetId: params.companyId,
      reason: params.reason,
      changes: { lifecycleStatus: { from: before.storedStatus, to: target } },
    });
    uow.emit({
      eventType: "company.lifecycle.changed.v1",
      tenantId: before.tenantId, owningCompanyId: params.companyId,
      aggregateType: "COMPANY", aggregateId: params.companyId,
      aggregateVersion: updated.recordVersion,
      data: {
        companyId: params.companyId, from: before.storedStatus, to: target,
        reason: params.reason, effectiveAt: now.toISOString(),
        graceExpiresAt: params.immediateLock ? null : graceExpiryFrom(now).toISOString(),
      },
    });

    return toView(updated, now);
  });
}

/** Reactivate. Restores ACTIVE or ACTIVE_ONBOARDING according to §9.2. */
export async function reactivateCompany(
  subject: PolicySubject,
  params: { companyId: string; reason: string }
): Promise<CompanyLifecycleView> {
  const decision = evaluate(subject, "platform.company.reactivate", { mutating: true });
  if (!decision.allow) throw forbidden("platform.company.reactivate", decision.reasons.join(","));

  const now = new Date(subject.ctx.now);

  return unitOfWork(subject.ctx, async (uow) => {
    const before = await loadForTransition(uow.tx, params.companyId, now);
    const target = reactivationTarget(before.facts);
    assertTransition(before.effectiveStatus, target);

    const updated = await guardedTransition(uow.tx, params.companyId, before, {
      lifecycleStatus: target,
      suspendedAt: null,
      graceExpiresAt: null,
      lockedAt: null,
      deletionEligibleAt: null,
      lifecycleReason: params.reason,
    });

    uow.audit({
      action: "company.reactivated", tenantId: before.tenantId, owningCompanyId: params.companyId,
      targetType: "COMPANY", targetId: params.companyId,
      reason: params.reason,
      changes: { lifecycleStatus: { from: before.storedStatus, to: target } },
    });
    uow.emit({
      eventType: "company.lifecycle.changed.v1",
      tenantId: before.tenantId, owningCompanyId: params.companyId,
      aggregateType: "COMPANY", aggregateId: params.companyId,
      aggregateVersion: updated.recordVersion,
      data: { companyId: params.companyId, from: before.storedStatus, to: target, reason: params.reason, effectiveAt: now.toISOString() },
    });

    return toView(updated, now);
  });
}

/**
 * Begin final deletion. Deliberately *not* a delete.
 *
 * §9.2 requires recent authentication, a typed confirmation, a reason and a
 * preflight. This moves the company to DELETING and hands the actual work to
 * the retention runbook; nothing here removes a row.
 */
export async function beginCompanyDeletion(
  subject: PolicySubject,
  params: { companyId: string; reason: string; typedConfirmation: string }
): Promise<CompanyLifecycleView> {
  const decision = evaluate(subject, "platform.company.delete", { mutating: true });
  if (!decision.allow) throw forbidden("platform.company.delete", decision.reasons.join(","));

  const now = new Date(subject.ctx.now);

  return unitOfWork(subject.ctx, async (uow) => {
    const before = await loadForTransition(uow.tx, params.companyId, now);

    // The typed confirmation is the company's own name. An "are you sure"
    // dialog is muscle memory; typing the name is not.
    if (params.typedConfirmation.trim() !== before.displayName) {
      throw new NestoError(
        "VALIDATION_FAILED",
        "Type the company's display name exactly to confirm deletion.",
        { internalReason: "typed-confirmation-mismatch" }
      );
    }
    if (before.effectiveStatus !== "DELETION_ELIGIBLE") {
      throw new NestoError(
        "WORKFLOW_TRANSITION_INVALID",
        "This company is not yet eligible for deletion.",
        { internalReason: `state ${before.effectiveStatus}, eligible at ${String(before.facts.deletionEligibleAt)}` }
      );
    }

    const updated = await guardedTransition(uow.tx, params.companyId, before, {
      lifecycleStatus: "DELETING",
      lifecycleReason: params.reason,
    });

    uow.audit({
      action: "company.deletion_started", tenantId: before.tenantId, owningCompanyId: params.companyId,
      targetType: "COMPANY", targetId: params.companyId,
      reason: params.reason,
      changes: { lifecycleStatus: { from: before.storedStatus, to: "DELETING" } },
    });
    uow.emit({
      eventType: "company.lifecycle.changed.v1",
      tenantId: before.tenantId, owningCompanyId: params.companyId,
      aggregateType: "COMPANY", aggregateId: params.companyId,
      aggregateVersion: updated.recordVersion,
      data: { companyId: params.companyId, from: before.storedStatus, to: "DELETING", reason: params.reason, effectiveAt: now.toISOString() },
    });

    return toView(updated, now);
  });
}

// ---------------------------------------------------------------------------

type Loaded = {
  tenantId: string;
  displayName: string;
  storedStatus: string;
  effectiveStatus: CompanyState;
  recordVersion: number;
  facts: LifecycleFacts;
};

async function loadForTransition(tx: TransactionalDb, companyId: string, now: Date): Promise<Loaded> {
  const row = await tx.company.findFirst({ where: { id: companyId }, select: LIFECYCLE_FIELDS });
  if (!row) throw notFoundInScope("Company", `company ${companyId} not visible in this scope`);
  return {
    tenantId: row.tenantId,
    displayName: row.displayName,
    storedStatus: row.lifecycleStatus,
    effectiveStatus: effectiveState(row, now),
    recordVersion: row.recordVersion,
    facts: row,
  };
}

function assertTransition(from: CompanyState, to: CompanyState): void {
  if (!canTransition(from, to)) {
    throw new NestoError(
      "WORKFLOW_TRANSITION_INVALID",
      `A company cannot move from ${from} to ${to}.`,
      { internalReason: `illegal transition ${from} -> ${to}` }
    );
  }
}

/**
 * The conditional write. `recordVersion` in the WHERE clause is what makes two
 * simultaneous administrators produce one change and one conflict, rather than
 * two changes where the second silently overwrites the first's grace expiry.
 */
async function guardedTransition(
  tx: TransactionalDb,
  companyId: string,
  before: Loaded,
  data: Record<string, unknown>
): Promise<LifecycleFacts & { id: string; displayName: string; recordVersion: number }> {
  const { count } = await tx.company.updateMany({
    where: { id: companyId, recordVersion: before.recordVersion },
    data: { ...data, recordVersion: before.recordVersion + 1 },
  });
  if (count !== 1) {
    throw new NestoError("CONFLICT", "This company changed while you were acting on it. Reload and try again.", {
      internalReason: `expected recordVersion ${before.recordVersion}`,
    });
  }
  const row = await tx.company.findFirst({ where: { id: companyId }, select: LIFECYCLE_FIELDS });
  return row as LifecycleFacts & { id: string; displayName: string; recordVersion: number };
}
