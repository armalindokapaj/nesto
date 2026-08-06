import { describe, expect, it } from "vitest";
import { calculateProcurementTotals, deriveDocumentStatus, isProcurementTransitionAllowed } from "@/lib/procurement";

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

describe("supplier document renewal status", () => {
  const now = new Date("2026-08-06T00:00:00Z");

  it("treats documents with no expiry as always valid", () => {
    expect(deriveDocumentStatus(null, now)).toBe("VALID");
  });

  it("flags documents inside the 30-day renewal window without marking them expired", () => {
    expect(deriveDocumentStatus(new Date("2026-08-20T00:00:00Z"), now)).toBe("EXPIRING_SOON");
  });

  it("marks a past expiry date as expired", () => {
    expect(deriveDocumentStatus(new Date("2026-07-01T00:00:00Z"), now)).toBe("EXPIRED");
  });
});
