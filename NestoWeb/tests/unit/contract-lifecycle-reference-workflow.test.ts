import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { approveContract, reconcileContractCompletion, ContractLifecycleError } from "@/server/contract-lifecycle";
import { dispatchDomainEvents } from "@/lib/domain-events";

// Reference-workflow coverage for Audit 2's canonical pipeline (§3) applied
// to the Contract Approved -> Finance Structure -> Payment Recorded ->
// Contractor Profile slice (§11's "select one vertical workflow" guidance).
// Exercises the domain layer directly rather than through the "use server"
// action wrappers, since those require a live session; the actions
// themselves are thin auth checks around exactly these functions.
describe("contract lifecycle reference workflow (audit 2)", () => {
  let tenantId: string;
  let userId: string;
  let contractorId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const tenant = await db.tenant.create({ data: { name: "Workflow Test Tenant", slug: `workflow-test-${stamp}` } });
    tenantId = tenant.id;
    await db.company.create({ data: { tenantId, name: "Workflow Co", isParent: true } });

    const user = await db.userIdentity.create({
      data: { email: `workflow-${stamp}@test.local`, username: `workflow${stamp}`, displayName: "Workflow Owner", passwordHash: "x" },
    });
    userId = user.id;
    await db.companyMembership.create({ data: { tenantId, userId, role: "OWNER" } });

    const contractor = await db.contractor.create({
      data: { tenantId, number: `CTR-WF-${stamp}`, name: "Workflow Contractor", tradeType: "Electrical" },
    });
    contractorId = contractor.id;
  });

  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } });
    await db.userIdentity.delete({ where: { id: userId } });
  });

  it("rejects approval of a contract with no assigned contractor", async () => {
    const contract = await db.contract.create({
      data: { tenantId, number: `CON-WF-${Date.now()}-1`, title: "No Contractor", valueMinor: 500 },
    });
    await expect(approveContract(tenantId, userId, contract.id)).rejects.toThrow(ContractLifecycleError);
  });

  it("rejects approving a contract that is already ACTIVE", async () => {
    const contract = await db.contract.create({
      data: { tenantId, number: `CON-WF-${Date.now()}-2`, title: "Already Active", valueMinor: 500, contractorId, status: "ACTIVE" },
    });
    await expect(approveContract(tenantId, userId, contract.id)).rejects.toThrow(ContractLifecycleError);
  });

  it("approving a contract transitions it to ACTIVE and the ContractApproved reaction creates the Finance Structure payment", async () => {
    const contract = await db.contract.create({
      data: { tenantId, number: `CON-WF-${Date.now()}-3`, title: "Approvable", valueMinor: 1000, contractorId, status: "DRAFT" },
    });

    await approveContract(tenantId, userId, contract.id);

    const updated = await db.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(updated.status).toBe("ACTIVE");

    const auditApproved = await db.auditEvent.findFirst({
      where: { tenantId, action: "CONTRACT_APPROVED", targetId: contract.id },
    });
    expect(auditApproved).not.toBeNull();

    const financeStructure = await db.invoice.findFirst({ where: { tenantId, contractId: contract.id, type: "PAYMENT" } });
    expect(financeStructure).not.toBeNull();
    // The payment matches the contract exactly. This previously asserted
    // 100_000 — the reaction was running toMinorUnits() over a payload field
    // that already held minor units, and the test locked that 100x in.
    expect(financeStructure!.amountMinor).toBe(contract.valueMinor);
    expect(financeStructure!.status).toBe("PENDING");

    const domainEvent = await db.domainEvent.findFirst({
      where: { tenantId, type: "ContractApproved" },
      orderBy: { createdAt: "desc" },
    });
    expect(domainEvent?.status).toBe("PROCESSED");

    // Dispatch idempotency (Audit 2 §5's "idempotent handlers" requirement):
    // re-dispatching an already-PROCESSED event must not create a second
    // Finance Structure invoice.
    await dispatchDomainEvents([domainEvent!.id]);
    const structures = await db.invoice.findMany({ where: { tenantId, contractId: contract.id, type: "PAYMENT" } });
    expect(structures).toHaveLength(1);
  });

  it("reconcileContractCompletion (the PaymentRecorded reaction) only completes a contract once it is paid in full, derived from posted payments", async () => {
    const contract = await db.contract.create({
      data: { tenantId, number: `CON-WF-${Date.now()}-4`, title: "Reconciliation", valueMinor: 2000, contractorId, status: "ACTIVE" },
    });
    const invoice = await db.invoice.create({
      data: {
        tenantId,
        contractId: contract.id,
        number: `PAY-WF-${Date.now()}`,
        type: "PAYMENT",
        amountMinor: 200_000,
        status: "PENDING",
      },
    });

    // Not yet posted — no reconciliation should happen.
    await reconcileContractCompletion(tenantId, contract.id);
    expect((await db.contract.findUniqueOrThrow({ where: { id: contract.id } })).status).toBe("ACTIVE");

    await db.invoice.update({ where: { id: invoice.id }, data: { status: "POSTED" } });
    await reconcileContractCompletion(tenantId, contract.id);

    const completed = await db.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(completed.status).toBe("COMPLETED");
    const auditCompleted = await db.auditEvent.findFirst({ where: { tenantId, action: "CONTRACT_COMPLETED", targetId: contract.id } });
    expect(auditCompleted).not.toBeNull();

    // Re-running after completion is a safe no-op (guarded by the ACTIVE-only check).
    await expect(reconcileContractCompletion(tenantId, contract.id)).resolves.toBeUndefined();
  });
});
