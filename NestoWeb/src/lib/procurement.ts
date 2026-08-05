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

export type CommercialLine = { quantity: number; unitPrice: number; discount?: number; tax?: number };

export function calculateProcurementTotals(lines: CommercialLine[], freight = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discount = lines.reduce((sum, line) => sum + (line.discount ?? 0), 0);
  const tax = lines.reduce((sum, line) => sum + (line.tax ?? 0), 0);
  return { subtotal, discount, tax, freight, total: subtotal - discount + tax + freight };
}
