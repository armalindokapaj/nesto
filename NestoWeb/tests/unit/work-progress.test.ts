import { describe, expect, it } from "vitest";
import { acceptedProgress, canTransitionProgressUpdate, canTransitionWorkPackage, validateAcceptedQuantity } from "@/lib/work-progress";

describe("work progress measurement integrity", () => {
  it("derives accepted physical progress from accepted scope quantities", () => {
    expect(acceptedProgress(25, 100)).toBe(25);
    expect(acceptedProgress(120, 100)).toBe(100);
    expect(acceptedProgress(10, 0)).toBe(0);
  });

  it("prevents accepted quantity from exceeding approved scope", () => {
    expect(() => validateAcceptedQuantity(80, 20, 100)).not.toThrow();
    expect(() => validateAcceptedQuantity(80, 21, 100)).toThrow(/approved scope/i);
    expect(() => validateAcceptedQuantity(80, 0, 100)).toThrow(/greater than zero/i);
  });
});

describe("work package lifecycle", () => {
  it("allows controlled execution transitions and rejects skipped states", () => {
    expect(canTransitionWorkPackage("DRAFT", "PLANNED")).toBe(true);
    expect(canTransitionWorkPackage("DRAFT", "COMPLETE")).toBe(false);
    expect(canTransitionWorkPackage("COMPLETE", "CLOSED")).toBe(true);
  });
});

describe("progress update verification workflow", () => {
  it("requires a draft claim to be submitted before verification, and blocks direct acceptance", () => {
    expect(canTransitionProgressUpdate("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionProgressUpdate("DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransitionProgressUpdate("SUBMITTED", "ACCEPTED")).toBe(false);
    expect(canTransitionProgressUpdate("UNDER_VERIFICATION", "ACCEPTED")).toBe(true);
  });

  it("allows a rejected claim to be corrected and resubmitted from draft, but never mutated once accepted", () => {
    expect(canTransitionProgressUpdate("REJECTED", "DRAFT")).toBe(true);
    expect(canTransitionProgressUpdate("ACCEPTED", "REJECTED")).toBe(false);
  });
});
