import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { assertTenant } from "@/lib/tenant";
import type { Role } from "@/lib/constants";

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

  return { ...employee, documents, canManage: canManageProfile(employee.userId, viewer), canViewContract: showContract };
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

  return db.documentFile.create({
    data: {
      tenantId,
      employeeId,
      name: input.name,
      category: input.category,
      visibility: input.category === "WORK_CONTRACT" ? "PRIVATE_HR" : "COMPANY",
      uploadedById: viewer.userId,
    },
  });
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
