import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { hasCapability } from "@/server/capabilities";
import { assertTenant } from "@/lib/tenant";
import type { Role } from "@/lib/constants";
import { invalidateDocumentBackfill } from "@/server/documents-module";

export type ProfileViewer = { userId: string; role: Role };

// The one section of an Employee's profile that is NOT company-wide visible
// — only the employee themselves and HR can see it.
export function canViewWorkContract(employeeUserId: string | null, viewer: ProfileViewer) {
  return employeeUserId === viewer.userId || can(viewer.role, "HR", "FULL");
}

// Editing the profile (photo, phone, CV, certifications) belongs to the
// employee themselves, or HR acting on their behalf.
export function canManageProfile(employeeUserId: string | null, viewer: ProfileViewer) {
  return employeeUserId === viewer.userId || can(viewer.role, "HR", "FULL");
}

// Salary is restricted to HR, Finance, Admin, and Owner — deliberately NOT
// gated the same way as Work Contract above (which the employee can also see
// themselves). Owner/Admin get access automatically via FULL_ADMIN in the
// permission matrix, so this one check covers exactly the requested set.
export function canViewSalary(viewer: ProfileViewer) {
  return can(viewer.role, "HR", "FULL") || can(viewer.role, "FINANCE", "FULL");
}

// Phase 1 Track C — `hr.compensation.view` was defined in lib/capabilities.ts
// as a sensitive, per-user-revocable capability, and hasCapability() was
// correctly implemented, but nothing that reads compensation ever called it:
// the other three capability keys gated something, this one did not. So an
// Owner could revoke it for a named person and the revoke did nothing.
//
// The role check stays and is ANDed with the capability, so nobody gains
// access who did not have it before — the capability can only take it away.
// The default holders (OWNER/ADMIN/HR/FINANCE) match the role check already,
// which is why this is a no-op until someone is explicitly revoked.
export async function canViewCompensation(tenantId: string, viewer: ProfileViewer) {
  if (!canViewSalary(viewer)) return false;
  return hasCapability(tenantId, viewer.userId, viewer.role, "hr.compensation.view");
}

// Directory — every active company member, company-wide (no HR gate), same
// spirit as PRD_10's "every company member can discover" principle applied
// to people instead of projects.
export async function listEmployeeDirectory(tenantId: string) {
  return db.employee.findMany({
    where: { tenantId },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      position: true,
      department: true,
      avatarColor: true,
      photoDataUrl: true,
      status: true,
    },
  });
}

export async function getEmployeeProfile(tenantId: string, employeeId: string, viewer: ProfileViewer) {
  const employee = assertTenant(
    await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { email: true } },
        manager: { select: { id: true, fullName: true } },
        documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { displayName: true } } } },
      },
    }),
    tenantId,
    "Employee"
  );

  const showContract = canViewWorkContract(employee.userId, viewer);
  const documents = employee.documents.filter((d) => d.visibility === "COMPANY" || showContract);
  const showSalary = await canViewCompensation(tenantId, viewer);
  // Fetched and attached only when authorized — the page component never
  // receives salary data at all rather than receiving-then-hiding it.
  const currentSalary = showSalary
    ? await db.salaryRecord.findFirst({ where: { tenantId, employeeId, status: "CURRENT" } })
    : null;

  return {
    ...employee,
    documents,
    canManage: canManageProfile(employee.userId, viewer),
    canViewContract: showContract,
    canViewSalary: showSalary,
    currentSalary,
  };
}

export type SalaryRecordInput = {
  effectiveStartDate: Date;
  currency: "EUR" | "ALL";
  grossSalary: number;
  netSalary: number;
  paymentFrequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "ANNUAL";
  notes?: string;
};

export async function getSalaryHistory(tenantId: string, employeeId: string, viewer: ProfileViewer) {
  assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  if (!(await canViewCompensation(tenantId, viewer))) throw new Error("You do not have permission to view salary information.");
  return db.salaryRecord.findMany({
    where: { tenantId, employeeId },
    orderBy: { effectiveStartDate: "desc" },
    include: {
      createdBy: { select: { displayName: true } },
      updatedBy: { select: { displayName: true } },
    },
  });
}

// Salary history is append-only: creating a record supersedes the current
// one (status flips to PREVIOUS, effectiveEndDate is set) rather than
// editing it in place — past records are never overwritten.
export async function createSalaryRecord(
  tenantId: string,
  employeeId: string,
  viewer: ProfileViewer,
  input: SalaryRecordInput
) {
  assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  if (!(await canViewCompensation(tenantId, viewer))) throw new Error("You do not have permission to manage salary information.");

  return db.$transaction(async (tx) => {
    await tx.salaryRecord.updateMany({
      where: { tenantId, employeeId, status: "CURRENT" },
      data: { status: "PREVIOUS", effectiveEndDate: input.effectiveStartDate },
    });
    return tx.salaryRecord.create({
      data: {
        tenantId,
        employeeId,
        effectiveStartDate: input.effectiveStartDate,
        currency: input.currency,
        grossSalary: input.grossSalary,
        netSalary: input.netSalary,
        paymentFrequency: input.paymentFrequency,
        notes: input.notes,
        status: "CURRENT",
        createdById: viewer.userId,
      },
    });
  });
}

export async function updateEmployeePhoto(tenantId: string, employeeId: string, viewer: ProfileViewer, photoDataUrl: string | null) {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  if (!canManageProfile(employee.userId, viewer)) throw new Error("You do not have permission to edit this profile.");
  return db.employee.update({ where: { id: employeeId }, data: { photoDataUrl } });
}

export async function updateEmployeeContact(tenantId: string, employeeId: string, viewer: ProfileViewer, phone: string) {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");
  if (!canManageProfile(employee.userId, viewer)) throw new Error("You do not have permission to edit this profile.");
  return db.employee.update({ where: { id: employeeId }, data: { phone } });
}

// PRD ask: "Working contract is private between employee and HR" — only HR
// issues it (an employee can view their own, but does not upload it
// themselves, since a work contract is an HR-issued record, not a
// self-submitted one — the same way a real HR system works).
export async function addEmployeeDocument(
  tenantId: string,
  employeeId: string,
  viewer: ProfileViewer,
  input: { name: string; category: "CV" | "CERTIFICATION" | "WORK_CONTRACT" }
) {
  const employee = assertTenant(await db.employee.findUnique({ where: { id: employeeId } }), tenantId, "Employee");

  if (input.category === "WORK_CONTRACT") {
    if (!can(viewer.role, "HR", "FULL")) throw new Error("Only HR can attach a work contract.");
  } else if (!canManageProfile(employee.userId, viewer)) {
    throw new Error("You do not have permission to edit this profile.");
  }

  const created = await db.documentFile.create({
    data: {
      tenantId,
      employeeId,
      name: input.name,
      category: input.category,
      visibility: input.category === "WORK_CONTRACT" ? "PRIVATE_HR" : "COMPANY",
      uploadedById: viewer.userId,
    },
  });
  // No Document Passport record yet — see invalidateDocumentBackfill.
  invalidateDocumentBackfill(tenantId);
  return created;
}

export async function removeEmployeeDocument(tenantId: string, documentId: string, viewer: ProfileViewer) {
  const doc = await db.documentFile.findUnique({ where: { id: documentId }, include: { employee: true } });
  if (!doc || doc.tenantId !== tenantId || !doc.employee) throw new Error("Document not found.");

  if (doc.category === "WORK_CONTRACT") {
    if (!can(viewer.role, "HR", "FULL")) throw new Error("Only HR can remove a work contract.");
  } else if (!canManageProfile(doc.employee.userId, viewer)) {
    throw new Error("You do not have permission to edit this profile.");
  }

  await db.documentFile.delete({ where: { id: documentId } });
}
