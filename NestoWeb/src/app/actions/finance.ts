"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { emitDomainEvent, dispatchDomainEvents } from "@/lib/domain-events";
import { buildActorSnapshot } from "@/lib/actor-snapshot";
import { fromMinorUnits } from "@/lib/money";

// PRD_2 §8 — posting is deliberate, atomic and one-way. Once an invoice is
// POSTED it cannot be edited; corrections go through reverseInvoiceAction,
// which creates a new equal-and-opposite ledger entry rather than mutating
// the original (§10.3). This is the reference implementation for the
// pattern — Stock/Contract/Time ledgers follow the same shape later.

export async function postInvoiceAction(invoiceId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "FINANCE", "FULL")) {
    throw new Error("You do not have permission to post financial records.");
  }

  const eventId = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found.");
    }
    if (invoice.status === "POSTED") {
      // Idempotent: a duplicate post request is a no-op, not an error.
      return null;
    }

    await tx.financialLedgerEntry.create({
      data: {
        tenantId,
        invoiceId,
        // FinancialLedgerEntry is Priority 2, still Float — convert back out.
        amount: fromMinorUnits(invoice.amountMinor, invoice.currency),
        currency: invoice.currency,
        postedById: user.id,
      },
    });

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "POSTED", postedAt: new Date(), postedById: user.id },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: user.id,
        action: "INVOICE_POSTED",
        targetType: "Invoice",
        targetId: invoiceId,
      },
    });

    // Reference workflow (Audit 2 §5) — posting a contract's PAYMENT invoice
    // is the "Payment Recorded" step; the reaction reconciles the contract's
    // completion state from the sum of its posted payments, never from a
    // direct status write. Other invoice types have no reaction registered.
    if (invoice.type === "PAYMENT" && invoice.contractId) {
      return emitDomainEvent(
        tx,
        tenantId,
        "PaymentRecorded",
        {
          invoiceId,
          contractId: invoice.contractId,
          amount: fromMinorUnits(invoice.amountMinor, invoice.currency),
          currency: invoice.currency,
        },
        {
          actorUserId: user.id,
          actorSnapshot: await buildActorSnapshot(tx, tenantId, user.id),
          sourceModule: "Finance",
          sourceRecordId: invoiceId,
        }
      );
    }
    return null;
  });

  if (eventId) await dispatchDomainEvents([eventId]);

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/invoices");
  revalidatePath("/dashboard/finance/payments");
  revalidatePath("/contracts");
}

export async function reverseInvoiceAction(invoiceId: string, reason: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "FINANCE", "FULL")) {
    throw new Error("You do not have permission to reverse financial records.");
  }
  if (!reason.trim()) {
    throw new Error("A reason is required to reverse a posted entry.");
  }

  await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { ledgerEntries: true } });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found.");
    }
    if (invoice.status !== "POSTED") {
      throw new Error("Only a posted invoice can be reversed.");
    }

    const originalEntry = invoice.ledgerEntries.find((e) => !e.reversesEntryId);
    if (!originalEntry) {
      throw new Error("No original ledger entry found to reverse.");
    }

    await tx.financialLedgerEntry.create({
      data: {
        tenantId,
        invoiceId,
        amount: -originalEntry.amount,
        currency: originalEntry.currency,
        postedById: user.id,
        reversesEntryId: originalEntry.id,
      },
    });

    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "REVERSED" } });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorId: user.id,
        action: "INVOICE_REVERSED",
        targetType: "Invoice",
        targetId: invoiceId,
        metadata: JSON.stringify({ reason }),
      },
    });
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/invoices");
}
