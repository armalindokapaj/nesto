import { toMinorUnits, sumMinor } from "@/lib/money";
export const PROCUREMENT_TRANSITIONS = {
  purchaseRequest: {
    DRAFT: ["SUBMITTED", "CANCELLED"], SUBMITTED: ["UNDER_REVIEW", "SOURCING", "REJECTED", "CANCELLED"], UNDER_REVIEW: ["SOURCING", "REJECTED", "CANCELLED"], SOURCING: ["PARTIALLY_ORDERED", "FULLY_ORDERED", "CANCELLED"], PARTIALLY_ORDERED: ["FULLY_ORDERED", "CANCELLED"], FULLY_ORDERED: ["CLOSED"],
  },
  rfq: {
    DRAFT: ["ISSUED", "CANCELLED"], ISSUED: ["OPEN", "CANCELLED"], OPEN: ["RESPONSES_RECEIVED", "EVALUATION", "CANCELLED"], RESPONSES_RECEIVED: ["EVALUATION", "NEGOTIATION", "CANCELLED"], EVALUATION: ["NEGOTIATION", "AWARDED", "CANCELLED"], NEGOTIATION: ["AWARDED", "CANCELLED"], AWARDED: ["CLOSED"],
  },
  purchaseOrder: {
    DRAFT: ["ISSUED", "CANCELLED"], ISSUED: ["ACKNOWLEDGED", "ON_HOLD", "CANCELLED"], ACKNOWLEDGED: ["PARTIALLY_FULFILLED", "FULFILLED", "ON_HOLD", "CANCELLED"], PARTIALLY_FULFILLED: ["FULFILLED", "ON_HOLD", "CANCELLED"], FULFILLED: ["CLOSED"], ON_HOLD: ["ISSUED", "ACKNOWLEDGED", "PARTIALLY_FULFILLED", "CANCELLED"],
  },
} as const;

export type ProcurementLifecycle = keyof typeof PROCUREMENT_TRANSITIONS;

export function isProcurementTransitionAllowed(lifecycle: ProcurementLifecycle, current: string, next: string): boolean {
  const map = PROCUREMENT_TRANSITIONS[lifecycle] as Record<string, readonly string[]>;
  return (map[current] ?? []).includes(next);
}

// PRD Procurement §27.2 Phase 1 "Foundation" — supplier documents (registration,
// insurance, tax certificates, ISO, licenses) carry an expiry the "Supplier
// Document Renewal" page surfaces ahead of time; this derives the display
// status purely from dates so it never drifts from a stored, staleable field.
export function deriveDocumentStatus(expiresAt: Date | null | undefined, now = new Date()): "VALID" | "EXPIRING_SOON" | "EXPIRED" {
  if (!expiresAt) return "VALID";
  const daysLeft = (expiresAt.getTime() - now.getTime()) / 86400000;
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= 30) return "EXPIRING_SOON";
  return "VALID";
}

export type CommercialLine = { quantity: number; unitPrice: number; discount?: number; tax?: number };

// Phase 15 — the minor-unit sibling. The decimal version above stays for any
// caller still working in decimals; anything writing to the database uses this,
// so a purchase order's stored totals are exact.
//
// Each line is rounded to the nearest cent once, at the line, rather than
// letting quantity * unitPrice accumulate float error across the sum —
// quantity is a genuine measured value and stays fractional.
export function calculateProcurementTotalsMinor(
  lines: CommercialLine[],
  currency = "EUR",
  freightMinor = 0
) {
  const lineTotalsMinor = lines.map((line) => Math.round(line.quantity * toMinorUnits(line.unitPrice, currency)));
  const subtotalMinor = sumMinor(lineTotalsMinor);
  const discountMinor = sumMinor(lines.map((line) => toMinorUnits(line.discount ?? 0, currency)));
  const taxMinor = sumMinor(lines.map((line) => toMinorUnits(line.tax ?? 0, currency)));
  return {
    lineTotalsMinor,
    subtotalMinor,
    discountMinor,
    taxMinor,
    freightMinor,
    totalMinor: subtotalMinor - discountMinor + taxMinor + freightMinor,
  };
}

export function calculateProcurementTotals(lines: CommercialLine[], freight = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discount = lines.reduce((sum, line) => sum + (line.discount ?? 0), 0);
  const tax = lines.reduce((sum, line) => sum + (line.tax ?? 0), 0);
  return { subtotal, discount, tax, freight, total: subtotal - discount + tax + freight };
}
