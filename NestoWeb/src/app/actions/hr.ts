"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createLeaveRequest, decideLeaveRequest, cancelApprovedLeave, updateApprovedLeave, recordEmploymentChange, terminateEmployment } from "@/server/hr";
import { invalidateDocumentBackfill } from "@/server/documents-module";

const CreateEmployeeSchema = z.object({
  fullName: z.string().min(2),
  position: z.string().min(1),
  department: z.string().min(1),
  hireDate: z.coerce.date(),
  phone: z.string().optional(),
  birthday: z.coerce.date().optional(),
  photoDataUrl: z.string().optional(),
});

// Matches PhotoUploadForm's own cap (src/components/hr/photo-upload-form.tsx)
// — same base64-data-URL convention, same limit, so a photo picked at
// creation time behaves identically to one changed later from the profile.
const MAX_PHOTO_BYTES = 700_000;

// Documents attached at creation time are metadata only — name + category +
// visibility, no file bytes — matching every other "document" feature in
// this app (src/components/documents/create-document-dialog.tsx and the
// Employee model's own doc comment both confirm this app has no object
// storage anywhere). Encoded as a JSON array in one hidden field since
// FormData has no native repeatable-group support and the employee doesn't
// exist yet to attach DocumentFile rows to one at a time.
const CreateEmployeeDocumentSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  visibility: z.enum(["COMPANY", "PRIVATE_HR"]),
});
const CreateEmployeeDocumentsSchema = z.array(CreateEmployeeDocumentSchema).max(20);

export type CreateEmployeeState = { error: string } | undefined;

export async function createEmployeeAction(_prev: CreateEmployeeState, formData: FormData): Promise<CreateEmployeeState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    return { error: "You do not have permission to add employees." };
  }

  const photoDataUrl = formData.get("photoDataUrl");
  if (typeof photoDataUrl === "string" && photoDataUrl.length > MAX_PHOTO_BYTES) {
    return { error: "Photo is too large." };
  }

  const parsed = CreateEmployeeSchema.safeParse({
    fullName: formData.get("fullName"),
    position: formData.get("position"),
    department: formData.get("department"),
    hireDate: formData.get("hireDate"),
    phone: formData.get("phone") || undefined,
    birthday: formData.get("birthday") || undefined,
    photoDataUrl: photoDataUrl || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const documentsRaw = formData.get("documents");
  let documents: z.infer<typeof CreateEmployeeDocumentsSchema> = [];
  if (typeof documentsRaw === "string" && documentsRaw.length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(documentsRaw);
    } catch {
      return { error: "Invalid document data." };
    }
    const parsedDocs = CreateEmployeeDocumentsSchema.safeParse(parsedJson);
    if (!parsedDocs.success) {
      return { error: "Invalid document data." };
    }
    documents = parsedDocs.data;
  }

  await db.$transaction(async (tx) => {
    const employee = await tx.employee.create({ data: { tenantId, ...parsed.data } });
    if (documents.length > 0) {
      await tx.documentFile.createMany({
        data: documents.map((d) => ({
          tenantId,
          employeeId: employee.id,
          name: d.name,
          category: d.category,
          visibility: d.visibility,
          uploadedById: user.id,
        })),
      });
    }
  });

  // The new rows carry no Document Passport — see invalidateDocumentBackfill.
  if (documents.length > 0) invalidateDocumentBackfill(tenantId);

  revalidatePath("/dashboard/hr/employees");
  revalidatePath("/dashboard/hr");
  revalidatePath("/employees");
  return undefined;
}

const RecordEmploymentSchema = z.object({
  employeeId: z.string().min(1),
  employmentType: z.enum(["EMPLOYEE", "CONTRACTOR", "EXTERNAL"]),
  contractType: z.enum(["FULL_TIME", "PART_TIME", "FIXED_TERM", "SEASONAL"]),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
  reportsToId: z.string().optional(),
  effectiveStartDate: z.coerce.date(),
  notes: z.string().optional(),
  isTransfer: z.coerce.boolean().optional(),
});

export type RecordEmploymentState = { error: string } | undefined;

// PRD_HR_Payroll_Workforce Phase 1 — records a new effective-dated
// EmploymentRelationship (closing the current ACTIVE one, if any). Gated on
// HR/FULL, same as every other HR-management action in this file.
export async function recordEmploymentChangeAction(_prev: RecordEmploymentState, formData: FormData): Promise<RecordEmploymentState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    return { error: "You do not have permission to record employment changes." };
  }

  const parsed = RecordEmploymentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    employmentType: formData.get("employmentType"),
    contractType: formData.get("contractType"),
    jobTitle: formData.get("jobTitle"),
    department: formData.get("department"),
    reportsToId: formData.get("reportsToId") || undefined,
    effectiveStartDate: formData.get("effectiveStartDate"),
    notes: formData.get("notes") || undefined,
    isTransfer: formData.get("isTransfer") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { employeeId, ...input } = parsed.data;
  await recordEmploymentChange(tenantId, employeeId, user.id, input);
  revalidatePath(`/dashboard/hr/employees/${employeeId}`);
  revalidatePath("/dashboard/hr/employees");
  return undefined;
}

const CreateLeaveSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export type CreateLeaveState = { error: string } | undefined;

// PRD_9 LEV-001 — reachable both from HR's "on behalf of any employee"
// dialog and from an employee's or direct superior's own request on
// /calendar; the three-way permission check below is what tells them apart.
export async function createLeaveRequestAction(_prev: CreateLeaveState, formData: FormData): Promise<CreateLeaveState> {
  const { tenantId, role, user } = await getCurrentUser();

  const parsed = CreateLeaveSchema.safeParse({
    employeeId: formData.get("employeeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  if (!can(role, "HR", "WRITE")) {
    const [target, own] = await Promise.all([
      db.employee.findUnique({ where: { id: parsed.data.employeeId } }),
      db.employee.findFirst({ where: { tenantId, userId: user.id } }),
    ]);
    const isSelf = target?.userId === user.id;
    const isDirectSuperior = Boolean(own && target?.managerId === own.id);
    if (!target || target.tenantId !== tenantId || (!isSelf && !isDirectSuperior)) {
      return { error: "You do not have permission to submit a leave request for this person." };
    }
  }

  await createLeaveRequest(tenantId, parsed.data.employeeId, user.id, {
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
  return undefined;
}

export async function decideLeaveRequestAction(leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    throw new Error("You do not have permission to decide leave requests.");
  }

  await decideLeaveRequest(tenantId, user.id, leaveRequestId, decision);
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
}

// PRD_9 LEV-003 — only HR (HR-FULL) may touch an approved entry afterward.
export async function cancelApprovedLeaveAction(leaveRequestId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    throw new Error("You do not have permission to cancel leave.");
  }
  await cancelApprovedLeave(tenantId, user.id, leaveRequestId);
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
}

const UpdateLeaveSchema = z.object({
  leaveRequestId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
});

export type UpdateLeaveState = { error: string } | undefined;

export async function updateApprovedLeaveAction(_prev: UpdateLeaveState, formData: FormData): Promise<UpdateLeaveState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) {
    return { error: "You do not have permission to edit leave." };
  }

  const parsed = UpdateLeaveSchema.safeParse({
    leaveRequestId: formData.get("leaveRequestId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await updateApprovedLeave(tenantId, user.id, parsed.data.leaveRequestId, {
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    reason: parsed.data.reason,
  });
  revalidatePath("/dashboard/hr/leave");
  revalidatePath("/dashboard/hr");
  revalidatePath("/calendar");
  return undefined;
}

export async function terminateEmploymentAction(employmentId: string, effectiveEndDate: string, notes?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) throw new Error("Not authorized");
  await terminateEmployment(tenantId, user.id, employmentId, new Date(effectiveEndDate), notes);
  revalidatePath("/dashboard/hr/offboarding");
  revalidatePath("/dashboard/hr/contracts");
  revalidatePath("/dashboard/hr");
}
