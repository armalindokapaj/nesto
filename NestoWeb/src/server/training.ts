import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { assertTenant } from "@/lib/tenant";
import type { Role } from "@/lib/constants";

export type TrainingViewer = { userId: string; role: Role };

// Self-or-HR — mirrors canViewWorkContract in employee-profile.ts exactly:
// each employee sees only their own training records, HR sees everyone's.
export function canViewOwnTraining(employeeUserId: string | null, viewer: TrainingViewer) {
  return employeeUserId === viewer.userId || can(viewer.role, "HR", "FULL");
}

// Gated by the caller (can(role,"HR","READ")) at the page level, same as
// listLeaveRequests/listEmployees — cross-department READ-level roles (e.g.
// CEO, Finance) can view but not assign/update (see assignTraining below).
export async function listTrainingForHr(tenantId: string) {
  return db.employeeTraining.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { id: true, fullName: true } } },
  });
}

export async function listTrainingForEmployee(tenantId: string, employeeId: string, viewer: TrainingViewer) {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  if (!canViewOwnTraining(employee.userId, viewer)) {
    throw new Error("You do not have permission to view this employee's training records.");
  }
  return db.employeeTraining.findMany({ where: { tenantId, employeeId }, orderBy: { createdAt: "desc" } });
}

export type AssignTrainingInput = {
  employeeId: string;
  name: string;
  provider?: string;
  dueDate?: Date;
  notes?: string;
};

export async function assignTraining(tenantId: string, viewer: TrainingViewer, input: AssignTrainingInput) {
  if (!can(viewer.role, "HR", "FULL")) throw new Error("Only HR can assign training.");
  assertTenant(await db.employee.findUnique({ where: { id: input.employeeId } }), tenantId, "Employee");

  return db.employeeTraining.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      name: input.name,
      provider: input.provider,
      dueDate: input.dueDate,
      notes: input.notes,
      assignedById: viewer.userId,
    },
  });
}

export async function updateTrainingStatus(
  tenantId: string,
  viewer: TrainingViewer,
  trainingId: string,
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED"
) {
  if (!can(viewer.role, "HR", "FULL")) throw new Error("Only HR can update training status.");
  const training = await db.employeeTraining.findUnique({ where: { id: trainingId } });
  if (!training || training.tenantId !== tenantId) throw new Error("Training record not found.");

  return db.employeeTraining.update({
    where: { id: trainingId },
    data: { status, completedDate: status === "COMPLETED" ? new Date() : training.completedDate },
  });
}
