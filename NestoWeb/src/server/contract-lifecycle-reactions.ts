import "server-only";
import { db } from "@/lib/db";
import { registerDomainEventHandler } from "@/lib/domain-events";
import { allocateNumber } from "@/server/number-series";
import { reconcileContractCompletion } from "@/server/contract-lifecycle";
import { toMinorUnits } from "@/lib/money";

// Reactions for the reference vertical workflow (Audit 2 §5): Contract
// Approved -> Finance Structure -> Payment Recorded -> Contractor Profile.
//
// The Contractor Profile leg needs no handler here: src/server/contractors.ts
// getContractor() already reads Contract rows live through the relation (no
// denormalized summary field to keep in sync per Audit 2 §4's "profile pages
// are composite views, not parallel databases"), so a Contract's status
// change is visible on the profile the moment its own transaction commits.

registerDomainEventHandler("ContractApproved", async (payload, event) => {
  const { contractId, projectId, number, value, currency } = payload as {
    contractId: string;
    projectId: string | null;
    number: string;
    value: number;
    currency: string;
  };

  const invoiceNumber = await allocateNumber(event.tenantId, "PAYMENT");
  const invoice = await db.invoice.create({
    data: {
      tenantId: event.tenantId,
      projectId: projectId ?? undefined,
      contractId,
      number: invoiceNumber,
      type: "PAYMENT",
      description: `Payment structure for contract ${number}`,
      amountMinor: toMinorUnits(value, currency),
      currency,
      status: "PENDING",
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId: event.tenantId,
      action: "FINANCE_STRUCTURE_CREATED",
      targetType: "Invoice",
      targetId: invoice.id,
      metadata: JSON.stringify({ contractId }),
    },
  });
});

registerDomainEventHandler("PaymentRecorded", async (payload, event) => {
  const { contractId } = payload as { contractId: string | null };
  if (!contractId) return;
  await reconcileContractCompletion(event.tenantId, contractId);
});
