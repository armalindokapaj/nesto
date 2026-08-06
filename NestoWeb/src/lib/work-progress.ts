export const WORK_PACKAGE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PLANNED", "CANCELLED"], PLANNED: ["READY", "CANCELLED"], READY: ["IN_PROGRESS", "SUSPENDED"],
  IN_PROGRESS: ["SUSPENDED", "SUBSTANTIALLY_COMPLETE", "COMPLETE"], SUSPENDED: ["READY", "IN_PROGRESS", "CANCELLED"],
  SUBSTANTIALLY_COMPLETE: ["IN_PROGRESS", "COMPLETE"], COMPLETE: ["CLOSED"], CLOSED: ["ARCHIVED"], CANCELLED: ["ARCHIVED"], ARCHIVED: [],
};

export function acceptedProgress(accepted: number, approved: number) {
  if (approved <= 0) return 0;
  return Math.min(100, Math.max(0, (accepted / approved) * 100));
}

export function validateAcceptedQuantity(current: number, addition: number, approved: number) {
  if (addition <= 0) throw new Error("Progress quantity must be greater than zero.");
  if (current + addition > approved + 1e-9) throw new Error("Accepted progress cannot exceed approved scope.");
}

export function canTransitionWorkPackage(from: string, to: string) {
  return (WORK_PACKAGE_TRANSITIONS[from] ?? []).includes(to);
}

// PRD Work Progress §45 Phase 1 — progress updates move through a
// submit/verify workflow; only an accepted update may roll up into the
// package's accepted quantity, and a rejected one can be corrected and
// resubmitted rather than silently vanishing.
export const PROGRESS_UPDATE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"], SUBMITTED: ["UNDER_VERIFICATION", "REJECTED"],
  UNDER_VERIFICATION: ["ACCEPTED", "REJECTED"], REJECTED: ["DRAFT"], ACCEPTED: [],
};

export function canTransitionProgressUpdate(from: string, to: string) {
  return (PROGRESS_UPDATE_TRANSITIONS[from] ?? []).includes(to);
}
