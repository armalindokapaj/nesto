import "server-only";
import { db } from "@/lib/db";
import { assertTenant, requireTenantContract } from "@/lib/tenant";
import { emitDomainEvent, dispatchDomainEvents } from "@/lib/domain-events";

// Audit 2 §7 "Controlled Record Lifecycles" — Contract is one of the five
// named state machines. This file is the ONLY place Contract.status is ever
// written; every other file (list pages, the contractor profile, etc.)
// treats it as read-only.
const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["COMPLETED", "TERMINATED"],
  COMPLETED: [],
  TERMINATED: [],
};

export class ContractLifecycleError extends Error {}

function assertTransition(from: string, to: string) {
  if (!CONTRACT_TRANSITIONS[from]?.includes(to)) {
    throw new ContractLifecycleError(`Contract cannot move from ${from} to ${to}.`);
  }
}

/**
 * Reference workflow, step 1 (Audit 2 §3's canonical pipeline — the caller
 * already did identity/company-context/authorization): tenant validation ->
 * business-rule validation -> transaction -> audit -> event. The
 * ContractApproved event's reaction (contract-lifecycle-reactions.ts) is
 * what creates the "Finance Structure" invoice — this function knows
 * nothing about Finance, which is the point: Contract stays the sole owner
 * of contract state, Finance reacts to it instead of being told what to do.
 */
export async function approveContract(tenantId: string, actorId: string, contractId: string) {
  await requireTenantContract(tenantId, contractId);

  const eventId = await db.$transaction(async (tx) => {
    const contract = assertTenant(await tx.contract.findUnique({ where: { id: contractId } }), tenantId, "Contract");
    assertTransition(contract.status, "ACTIVE");
    if (!contract.contractorId) {
      throw new ContractLifecycleError("A contract needs an assigned contractor before it can be approved.");
    }

    await tx.contract.update({ where: { id: contractId }, data: { status: "ACTIVE" } });

    await tx.auditEvent.create({
      data: { tenantId, actorId, action: "CONTRACT_APPROVED", targetType: "Contract", targetId: contractId },
    });

    return emitDomainEvent(tx, tenantId, "ContractApproved", {
      contractId,
      projectId: contract.projectId,
      contractorId: contract.contractorId,
      number: contract.number,
      value: contract.value,
      currency: contract.currency,
    });
  });

  await dispatchDomainEvents([eventId]);
}

/**
 * Reference workflow, final step: Audit 2 §8 "Financial Truth and
 * Reconciliation" — completion is DERIVED from posted payment records, never
 * set directly by a user action. Called only by the PaymentRecorded
 * reaction, once per posted PAYMENT invoice; re-running it against a
 * contract that isn't ACTIVE, or that hasn't reached its full value yet, is
 * a safe no-op.
 */
export async function reconcileContractCompletion(tenantId: string, contractId: string) {
  await db.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({ where: { id: contractId } });
    if (!contract || contract.tenantId !== tenantId || contract.status !== "ACTIVE") return;

    const paid = await tx.invoice.aggregate({
      where: { tenantId, contractId, type: "PAYMENT", status: "POSTED" },
      _sum: { amount: true },
    });
    if ((paid._sum.amount ?? 0) < contract.value) return;

    assertTransition(contract.status, "COMPLETED");
    await tx.contract.update({ where: { id: contractId }, data: { status: "COMPLETED" } });
    await tx.auditEvent.create({
      data: {
        tenantId,
        action: "CONTRACT_COMPLETED",
        targetType: "Contract",
        targetId: contractId,
        metadata: JSON.stringify({ totalPaid: paid._sum.amount, contractValue: contract.value }),
      },
    });
  });
}
