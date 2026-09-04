/**
 * The company lifecycle machine — PRD §9.1, §9.2.
 *
 * Two ideas here are load-bearing.
 *
 * **The gate is computed, not stored.** `graceExpiresAt` and `lockedAt` are
 * wall-clock facts; the *state* is derived from them on every read. A company
 * whose grace expired three seconds ago must not get one more write because the
 * scheduler has not run yet. The scheduler materialises the state for listing
 * and notification; it is never what enforces it.
 *
 * **Nothing here deletes anything.** Reaching deletion eligibility is a state,
 * not an action (§9.2). Final deletion needs recent authentication, a typed
 * confirmation, a reason, a preflight and a human.
 */

export const COMPANY_STATES = [
  "DRAFT", "UNDER_REVIEW", "ACTIVE_ONBOARDING", "ACTIVE",
  "READ_ONLY_GRACE", "LOCKED", "DELETION_ELIGIBLE", "DELETING", "DELETED",
] as const;
export type CompanyState = (typeof COMPANY_STATES)[number];

/** §9.2: standard suspension creates exactly 120 hours of read-only access. */
export const GRACE_HOURS = 120;
/** §9.2: deletion becomes eligible 365 days after `lockedAt`. */
export const DELETION_ELIGIBLE_DAYS = 365;
/** §9.2: warnings at suspension, then 30 and 7 days before eligibility. */
export const DELETION_WARNING_DAYS = [30, 7] as const;

/** Legal transitions. Anything absent is refused, including the ones that look
 *  harmless — there is no path back from DELETED, and none from DELETING. */
const TRANSITIONS: Record<CompanyState, CompanyState[]> = {
  DRAFT: ["UNDER_REVIEW", "ACTIVE_ONBOARDING"],
  UNDER_REVIEW: ["ACTIVE_ONBOARDING", "DRAFT"],
  ACTIVE_ONBOARDING: ["ACTIVE", "READ_ONLY_GRACE", "LOCKED"],
  ACTIVE: ["READ_ONLY_GRACE", "LOCKED"],
  READ_ONLY_GRACE: ["ACTIVE", "ACTIVE_ONBOARDING", "LOCKED"],
  LOCKED: ["ACTIVE", "ACTIVE_ONBOARDING", "DELETION_ELIGIBLE"],
  DELETION_ELIGIBLE: ["ACTIVE", "ACTIVE_ONBOARDING", "DELETING"],
  DELETING: ["DELETED"],
  DELETED: [],
};

export function canTransition(from: CompanyState, to: CompanyState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export type LifecycleFacts = {
  lifecycleStatus: string;
  graceExpiresAt: Date | null;
  lockedAt: Date | null;
  deletionEligibleAt: Date | null;
  onboardingCompletedAt: Date | null;
};

/**
 * The state as of `now`, which is what every request gate uses.
 *
 * Stored status is the starting point; the clock can only move a company
 * *further* along the lifecycle, never back. That asymmetry is deliberate: an
 * expired grace must bite immediately, while a reactivation is always a
 * deliberate act by a Platform Admin.
 */
export function effectiveState(facts: LifecycleFacts, now: Date = new Date()): CompanyState {
  const stored = facts.lifecycleStatus as CompanyState;

  if (stored === "READ_ONLY_GRACE" && facts.graceExpiresAt && facts.graceExpiresAt <= now) {
    return "LOCKED";
  }
  if (stored === "LOCKED" && facts.deletionEligibleAt && facts.deletionEligibleAt <= now) {
    return "DELETION_ELIGIBLE";
  }
  return stored;
}

const READABLE = new Set<CompanyState>(["ACTIVE", "ACTIVE_ONBOARDING", "READ_ONLY_GRACE"]);
const MUTABLE = new Set<CompanyState>(["ACTIVE", "ACTIVE_ONBOARDING"]);

export function allowsRead(state: CompanyState): boolean {
  return READABLE.has(state);
}

/** Read-only is enforced at the API, worker and portal layers, not only in the
 *  UI (§9.2) — which is why this predicate lives in the domain, not a guard. */
export function allowsMutation(state: CompanyState): boolean {
  return MUTABLE.has(state);
}

export function graceExpiryFrom(suspendedAt: Date): Date {
  return new Date(suspendedAt.getTime() + GRACE_HOURS * 3600_000);
}

export function deletionEligibleFrom(lockedAt: Date): Date {
  return new Date(lockedAt.getTime() + DELETION_ELIGIBLE_DAYS * 24 * 3600_000);
}

/** Reactivation restores ACTIVE or ACTIVE_ONBOARDING according to whether
 *  onboarding had been completed (§9.2). */
export function reactivationTarget(facts: LifecycleFacts): CompanyState {
  return facts.onboardingCompletedAt ? "ACTIVE" : "ACTIVE_ONBOARDING";
}
