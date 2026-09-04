/**
 * The company lifecycle — PRD §9.1, §9.2 and E2E-14.
 *
 * The tests that matter here are the ones about *time*: a grace period that has
 * expired must block writes on the very next request, whether or not any
 * scheduler has run.
 */

import { describe, it, expect } from "vitest";
import {
  effectiveState, canTransition, allowsRead, allowsMutation,
  graceExpiryFrom, deletionEligibleFrom, reactivationTarget,
  GRACE_HOURS, DELETION_ELIGIBLE_DAYS, COMPANY_STATES,
} from "./lifecycle";

const base = {
  lifecycleStatus: "ACTIVE",
  graceExpiresAt: null,
  lockedAt: null,
  deletionEligibleAt: null,
  onboardingCompletedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("the nine protected states", () => {
  it("are exactly Appendix A's", () => {
    expect([...COMPANY_STATES]).toEqual([
      "DRAFT", "UNDER_REVIEW", "ACTIVE_ONBOARDING", "ACTIVE",
      "READ_ONLY_GRACE", "LOCKED", "DELETION_ELIGIBLE", "DELETING", "DELETED",
    ]);
  });
});

describe("suspension and the 120-hour grace (§9.2)", () => {
  it("sets the expiry exactly 120 hours out", () => {
    const suspended = new Date("2026-09-04T12:00:00Z");
    expect(graceExpiryFrom(suspended).toISOString()).toBe("2026-09-09T12:00:00.000Z");
    expect(GRACE_HOURS).toBe(120);
  });

  it("permits reads and refuses writes while the grace is running", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const state = effectiveState(
      { ...base, lifecycleStatus: "READ_ONLY_GRACE", graceExpiresAt: new Date("2026-09-09T12:00:00Z") },
      now
    );
    expect(state).toBe("READ_ONLY_GRACE");
    expect(allowsRead(state)).toBe(true);
    expect(allowsMutation(state)).toBe(false);
  });

  it("locks the moment the grace expires, without waiting for a scheduler", () => {
    // The whole reason the gate is computed rather than stored. A company whose
    // grace ended three seconds ago must not get one more write.
    const expiry = new Date("2026-09-09T12:00:00Z");
    const justAfter = new Date(expiry.getTime() + 3000);
    const state = effectiveState(
      { ...base, lifecycleStatus: "READ_ONLY_GRACE", graceExpiresAt: expiry },
      justAfter
    );
    expect(state).toBe("LOCKED");
    expect(allowsRead(state)).toBe(false);
  });

  it("does not lock a second before the grace expires", () => {
    const expiry = new Date("2026-09-09T12:00:00Z");
    const state = effectiveState(
      { ...base, lifecycleStatus: "READ_ONLY_GRACE", graceExpiresAt: expiry },
      new Date(expiry.getTime() - 1000)
    );
    expect(state).toBe("READ_ONLY_GRACE");
  });
});

describe("deletion eligibility (§9.2)", () => {
  it("is 365 days after lock, and is computed from lockedAt", () => {
    const locked = new Date("2026-09-04T12:00:00Z");
    expect(DELETION_ELIGIBLE_DAYS).toBe(365);
    expect(deletionEligibleFrom(locked).toISOString()).toBe("2027-09-04T12:00:00.000Z");
  });

  it("becomes eligible on its own, but eligibility is a state and not a deletion", () => {
    const eligibleAt = new Date("2027-09-04T12:00:00Z");
    const state = effectiveState(
      { ...base, lifecycleStatus: "LOCKED", lockedAt: new Date("2026-09-04T12:00:00Z"), deletionEligibleAt: eligibleAt },
      new Date("2027-09-05T00:00:00Z")
    );
    expect(state).toBe("DELETION_ELIGIBLE");
    // Reaching eligibility never auto-deletes: DELETED is not reachable from
    // here without passing through a deliberate DELETING.
    expect(canTransition("DELETION_ELIGIBLE", "DELETED")).toBe(false);
    expect(canTransition("DELETION_ELIGIBLE", "DELETING")).toBe(true);
  });

  it("can still be reactivated after eligibility", () => {
    expect(canTransition("DELETION_ELIGIBLE", "ACTIVE")).toBe(true);
  });
});

describe("transitions", () => {
  it("allows the documented path from candidate to live", () => {
    expect(canTransition("DRAFT", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("UNDER_REVIEW", "ACTIVE_ONBOARDING")).toBe(true);
    expect(canTransition("ACTIVE_ONBOARDING", "ACTIVE")).toBe(true);
  });

  it("allows an immediate lock from active, for a documented security incident", () => {
    expect(canTransition("ACTIVE", "LOCKED")).toBe(true);
  });

  it("has no way back from DELETED", () => {
    for (const state of COMPANY_STATES) {
      expect(canTransition("DELETED", state), `DELETED -> ${state}`).toBe(false);
    }
  });

  it("refuses to skip from active straight to deletion", () => {
    expect(canTransition("ACTIVE", "DELETING")).toBe(false);
    expect(canTransition("ACTIVE", "DELETION_ELIGIBLE")).toBe(false);
  });

  it("refuses to reactivate out of DELETING", () => {
    expect(canTransition("DELETING", "ACTIVE")).toBe(false);
  });
});

describe("reactivation (§9.2)", () => {
  it("returns to ACTIVE when onboarding was complete", () => {
    expect(reactivationTarget(base)).toBe("ACTIVE");
  });

  it("returns to ACTIVE_ONBOARDING when it was not", () => {
    expect(reactivationTarget({ ...base, onboardingCompletedAt: null })).toBe("ACTIVE_ONBOARDING");
  });
});

describe("what each state permits", () => {
  it("permits business writes only while active or onboarding", () => {
    expect(allowsMutation("ACTIVE")).toBe(true);
    expect(allowsMutation("ACTIVE_ONBOARDING")).toBe(true);
    for (const state of ["DRAFT", "UNDER_REVIEW", "READ_ONLY_GRACE", "LOCKED", "DELETION_ELIGIBLE", "DELETING", "DELETED"] as const) {
      expect(allowsMutation(state), state).toBe(false);
    }
  });

  it("permits no session at all once locked", () => {
    for (const state of ["LOCKED", "DELETION_ELIGIBLE", "DELETING", "DELETED"] as const) {
      expect(allowsRead(state), state).toBe(false);
    }
  });
});
