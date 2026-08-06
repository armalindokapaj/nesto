// PRD_HSE_Module §49.1 "Phase 1 - Operational Foundation" rework — pure,
// framework-agnostic lifecycle rules for the new Inspections/Observations/
// Incidents/Corrective Actions models. Mirrors the lib/work-progress.ts and
// lib/procurement.ts pattern: transitions as lookup tables, derivations as
// pure functions, nothing here touches the database.

export const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  REPORTED: ["UNDER_INVESTIGATION", "CLOSED"],
  UNDER_INVESTIGATION: ["ACTION_PENDING", "CLOSED"],
  ACTION_PENDING: ["CLOSED"],
  CLOSED: [],
};

export function canTransitionIncident(from: string, to: string) {
  return (INCIDENT_TRANSITIONS[from] ?? []).includes(to);
}

// An incident cannot be closed while it still has an open or in-progress
// corrective action — the PRD's "governed records" rule (AC-031/032) applies
// to closure the same way it does to approval.
export function canCloseIncident(openActionCount: number) {
  return openActionCount === 0;
}

export const CORRECTIVE_ACTION_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "COMPLETED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

export function canTransitionCorrectiveAction(from: string, to: string) {
  return (CORRECTIVE_ACTION_TRANSITIONS[from] ?? []).includes(to);
}

export function isCorrectiveActionOverdue(dueDate: Date | null | undefined, status: string, now = new Date()) {
  return status !== "COMPLETED" && !!dueDate && dueDate.getTime() < now.getTime();
}

// A site induction is only valid to rely on for the work-start gate while
// its expiry hasn't passed; no expiry means it never lapses.
export function isInductionValid(expiresAt: Date | null | undefined, now = new Date()) {
  return !expiresAt || expiresAt.getTime() >= now.getTime();
}
