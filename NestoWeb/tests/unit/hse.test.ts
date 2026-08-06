import { describe, expect, it } from "vitest";
import {
  canCloseIncident,
  canTransitionCorrectiveAction,
  canTransitionIncident,
  isCorrectiveActionOverdue,
  isInductionValid,
} from "@/lib/hse";

describe("incident lifecycle", () => {
  it("moves through report → investigation → closure and rejects skipped states", () => {
    expect(canTransitionIncident("REPORTED", "UNDER_INVESTIGATION")).toBe(true);
    expect(canTransitionIncident("REPORTED", "ACTION_PENDING")).toBe(false);
    expect(canTransitionIncident("CLOSED", "REPORTED")).toBe(false);
  });

  it("blocks closure while corrective actions are still open", () => {
    expect(canCloseIncident(0)).toBe(true);
    expect(canCloseIncident(2)).toBe(false);
  });
});

describe("corrective action lifecycle", () => {
  it("allows the controlled path and rejects completing directly from nothing", () => {
    expect(canTransitionCorrectiveAction("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransitionCorrectiveAction("OPEN", "COMPLETED")).toBe(true);
    expect(canTransitionCorrectiveAction("COMPLETED", "OPEN")).toBe(false);
  });

  it("flags an overdue action only while it is still unresolved", () => {
    const now = new Date("2026-08-06T00:00:00Z");
    expect(isCorrectiveActionOverdue(new Date("2026-08-01T00:00:00Z"), "OPEN", now)).toBe(true);
    expect(isCorrectiveActionOverdue(new Date("2026-08-01T00:00:00Z"), "COMPLETED", now)).toBe(false);
    expect(isCorrectiveActionOverdue(null, "OPEN", now)).toBe(false);
  });
});

describe("induction validity", () => {
  it("treats a never-expiring induction as always valid, and checks the date otherwise", () => {
    const now = new Date("2026-08-06T00:00:00Z");
    expect(isInductionValid(null, now)).toBe(true);
    expect(isInductionValid(new Date("2026-09-01T00:00:00Z"), now)).toBe(true);
    expect(isInductionValid(new Date("2026-07-01T00:00:00Z"), now)).toBe(false);
  });
});
