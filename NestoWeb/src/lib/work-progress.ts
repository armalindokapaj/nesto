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
