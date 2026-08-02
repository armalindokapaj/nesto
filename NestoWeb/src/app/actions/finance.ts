"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";

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

  await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found.");
    }
    if (invoice.status === "POSTED") {
      // Idempotent: a duplicate post request is a no-op, not an error.
      return;
    }

    await tx.financialLedgerEntry.create({
      data: {
        tenantId,
        invoiceId,
        amount: invoice.amount,
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
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/invoices");
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
