import { describe, expect, it } from "vitest";
import { calculateProcurementTotals, isProcurementTransitionAllowed } from "@/lib/procurement";

describe("procurement lifecycle controls", () => {
  it("allows the controlled request path and rejects skipped states", () => {
    expect(isProcurementTransitionAllowed("purchaseRequest", "DRAFT", "SUBMITTED")).toBe(true);
    expect(isProcurementTransitionAllowed("purchaseRequest", "DRAFT", "FULLY_ORDERED")).toBe(false);
  });

  it("keeps issued purchase orders immutable through explicit lifecycle actions", () => {
    expect(isProcurementTransitionAllowed("purchaseOrder", "ISSUED", "ACKNOWLEDGED")).toBe(true);
    expect(isProcurementTransitionAllowed("purchaseOrder", "ISSUED", "DRAFT")).toBe(false);
  });

  it("does not award an RFQ directly from draft", () => {
    expect(isProcurementTransitionAllowed("rfq", "DRAFT", "AWARDED")).toBe(false);
  });
});

describe("procurement commercial totals", () => {
  it("reconciles line quantities, discounts, taxes and freight", () => {
    expect(calculateProcurementTotals([
      { quantity: 10, unitPrice: 25, discount: 10, tax: 24 },
      { quantity: 2, unitPrice: 100 },
    ], 15)).toEqual({ subtotal: 450, discount: 10, tax: 24, freight: 15, total: 479 });
  });
});
