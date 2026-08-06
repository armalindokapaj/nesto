"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import {
  createHseReport,
  updateHseReportStatus,
  createHazard,
  setHazardStatus,
  createRiskAssessment,
  approveRiskAssessment,
  requestPermitToWork,
  setPermitToWorkStatus,
  issueStopWorkOrder,
  releaseStopWorkOrder,
  createInspection,
  completeInspection,
  createObservation,
  closeObservation,
  createIncident,
  transitionIncident,
  createCorrectiveAction,
  transitionCorrectiveAction,
  createInduction,
  createToolboxTalk,
  addEmergencyContact,
} from "@/server/hse";

const CreateHseReportSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  title: z.string().min(2, "Enter a title"),
  description: z.string().min(5, "Describe what was found"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export type HseActionState = { error: string } | undefined;

export async function createHseReportAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) {
    return { error: "You do not have permission to file safety reports." };
  }

  const parsed = CreateHseReportSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description"),
    severity: formData.get("severity") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createHseReport(tenantId, user.id, parsed.data);
  revalidatePath("/hse-reports");
  return undefined;
}

export async function updateHseReportStatusAction(reportId: string, status: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) {
    throw new Error("You do not have permission to update safety reports.");
  }
  await updateHseReportStatus(tenantId, reportId, status);
  revalidatePath("/hse-reports");
}

// ---------------------------------------------------------------------------
// PRD_HSE_Module — Phase 1. Reuses the HSE_REPORTS resource for gating (see
// permissions.ts) — the whole HSE domain now, not just incident reports.
// ---------------------------------------------------------------------------

const CreateHazardSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  title: z.string().min(2),
  description: z.string().min(2),
  category: z.enum(["GENERAL", "ELECTRICAL", "HEIGHT", "CONFINED_SPACE", "CHEMICAL", "MECHANICAL", "ENVIRONMENTAL"]).optional(),
  likelihood: z.enum(["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]).optional(),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"]).optional(),
  controlLevel: z.enum(["ELIMINATE", "SUBSTITUTE", "ENGINEERING", "ADMINISTRATIVE", "PPE"]).optional(),
  controlNotes: z.string().optional(),
});

export async function createHazardAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to log hazards." };

  const parsed = CreateHazardSchema.safeParse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    likelihood: formData.get("likelihood") || undefined,
    severity: formData.get("severity") || undefined,
    controlLevel: formData.get("controlLevel") || undefined,
    controlNotes: formData.get("controlNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createHazard(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/hazards");
  revalidatePath("/dashboard/hse");
  return undefined;
}

export async function setHazardStatusAction(hazardId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) throw new Error("You do not have permission to update hazards.");
  await setHazardStatus(tenantId, user.id, hazardId, status);
  revalidatePath("/dashboard/hse/hazards");
  revalidatePath("/dashboard/hse");
}

const CreateRiskAssessmentSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  hazardId: z.string().optional(),
  title: z.string().min(2),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});

export async function createRiskAssessmentAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to create risk assessments." };

  const parsed = CreateRiskAssessmentSchema.safeParse({
    projectId: formData.get("projectId"),
    hazardId: formData.get("hazardId") || undefined,
    title: formData.get("title"),
    validFrom: formData.get("validFrom") || undefined,
    validTo: formData.get("validTo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createRiskAssessment(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/hazards");
  return undefined;
}

export async function approveRiskAssessmentAction(riskAssessmentId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "FULL")) throw new Error("You do not have permission to approve risk assessments.");
  await approveRiskAssessment(tenantId, user.id, riskAssessmentId);
  revalidatePath("/dashboard/hse/hazards");
}

const RequestPermitSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  permitType: z.enum([
    "HOT_WORK",
    "CONFINED_SPACE_ENTRY",
    "WORKING_AT_HEIGHT",
    "EXCAVATION",
    "ELECTRICAL_ISOLATION",
    "LIFTING",
    "RADIOGRAPHY",
    "DEMOLITION",
    "OTHER",
  ]),
  description: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});

export async function requestPermitToWorkAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to request permits to work." };

  const parsed = RequestPermitSchema.safeParse({
    projectId: formData.get("projectId"),
    permitType: formData.get("permitType"),
    description: formData.get("description") || undefined,
    validFrom: formData.get("validFrom") || undefined,
    validTo: formData.get("validTo") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await requestPermitToWork(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/permits");
  return undefined;
}

// Activation is server-authoritative — only FULL (HSE-owning) roles may move
// a permit to ACTIVE; anyone with WRITE can request one.
export async function setPermitToWorkStatusAction(permitId: string, status: string) {
  const { tenantId, role, user } = await getCurrentUser();
  const required = status === "ACTIVE" ? "FULL" : "WRITE";
  if (!can(role, "HSE_REPORTS", required)) throw new Error("You do not have permission to change this permit's status.");
  await setPermitToWorkStatus(tenantId, user.id, permitId, status);
  revalidatePath(`/dashboard/hse/permits/${permitId}`);
  revalidatePath("/dashboard/hse/permits");
}

const IssueStopWorkSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  scopeType: z.enum(["PROJECT", "ZONE", "WORK_PACKAGE", "CONTRACTOR", "ASSET", "PERMIT", "ACTIVITY", "MATERIAL"]),
  scopeRef: z.string().optional(),
  reason: z.string().min(2, "Describe why work is being stopped"),
});

// Fast-issue path — WRITE is enough (anyone empowered can stop work
// immediately, per the PRD); only release is FULL-gated below.
export async function issueStopWorkOrderAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to issue a stop-work order." };

  const parsed = IssueStopWorkSchema.safeParse({
    projectId: formData.get("projectId"),
    scopeType: formData.get("scopeType"),
    scopeRef: formData.get("scopeRef") || undefined,
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await issueStopWorkOrder(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/stop-work");
  revalidatePath("/dashboard/hse");
  return undefined;
}

const ReleaseStopWorkSchema = z.object({
  orderId: z.string().min(1),
  releaseNotes: z.string().optional(),
});

export async function releaseStopWorkOrderAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "FULL")) return { error: "You do not have permission to release a stop-work order." };

  const parsed = ReleaseStopWorkSchema.safeParse({
    orderId: formData.get("orderId"),
    releaseNotes: formData.get("releaseNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await releaseStopWorkOrder(tenantId, user.id, parsed.data.orderId, parsed.data.releaseNotes);
  revalidatePath("/dashboard/hse/stop-work");
  revalidatePath("/dashboard/hse");
  return undefined;
}

// ---------------------------------------------------------------------------
// PRD_HSE_Module §49.1 Phase 1 rework — Inspections, Observations, Incidents,
// Corrective Actions, Inductions, Toolbox Talks, Emergency Contacts.
// ---------------------------------------------------------------------------

const CreateInspectionSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  type: z.enum(["SITE_SAFETY", "SCAFFOLD", "EQUIPMENT", "ELECTRICAL", "ENVIRONMENTAL", "OTHER"]).optional(),
  location: z.string().optional(),
  findings: z.string().optional(),
});

export async function createInspectionAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to log inspections." };
  const parsed = CreateInspectionSchema.safeParse({ projectId: formData.get("projectId"), type: formData.get("type") || undefined, location: formData.get("location") || undefined, findings: formData.get("findings") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createInspection(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/inspections");
  revalidatePath("/dashboard/hse");
  return undefined;
}

export async function completeInspectionAction(inspectionId: string, outcome: string, findings?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) throw new Error("You do not have permission to complete inspections.");
  await completeInspection(tenantId, user.id, inspectionId, outcome, findings);
  revalidatePath("/dashboard/hse/inspections");
}

const CreateObservationSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  type: z.enum(["SAFE_ACT", "UNSAFE_ACT", "SAFE_CONDITION", "UNSAFE_CONDITION", "NEAR_MISS"]).optional(),
  description: z.string().min(2),
  location: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export async function createObservationAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to report observations." };
  const parsed = CreateObservationSchema.safeParse({ projectId: formData.get("projectId"), type: formData.get("type") || undefined, description: formData.get("description"), location: formData.get("location") || undefined, severity: formData.get("severity") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createObservation(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/observations");
  revalidatePath("/dashboard/hse");
  return undefined;
}

export async function closeObservationAction(observationId: string, actionTaken?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) throw new Error("You do not have permission to close observations.");
  await closeObservation(tenantId, user.id, observationId, actionTaken);
  revalidatePath("/dashboard/hse/observations");
}

const CreateIncidentSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  classification: z.enum(["NEAR_MISS", "FIRST_AID", "MEDICAL_TREATMENT", "LOST_TIME", "FATALITY", "PROPERTY_DAMAGE", "ENVIRONMENTAL"]).optional(),
  title: z.string().min(2),
  description: z.string().min(2),
  occurredAt: z.coerce.date(),
  location: z.string().optional(),
  injuredPersonRef: z.string().optional(),
});

export async function createIncidentAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to report incidents." };
  const parsed = CreateIncidentSchema.safeParse({ projectId: formData.get("projectId"), classification: formData.get("classification") || undefined, title: formData.get("title"), description: formData.get("description"), occurredAt: formData.get("occurredAt"), location: formData.get("location") || undefined, injuredPersonRef: formData.get("injuredPersonRef") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createIncident(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/incidents");
  revalidatePath("/dashboard/hse");
  return undefined;
}

// Closing an incident (and assigning an investigator) is FULL-gated — the
// same "governed record" boundary used for risk assessment approval and
// stop-work release.
export async function transitionIncidentAction(incidentId: string, status: string, investigatorId?: string, rootCause?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  const required = status === "CLOSED" ? "FULL" : "WRITE";
  if (!can(role, "HSE_REPORTS", required)) throw new Error("You do not have permission to change this incident's status.");
  await transitionIncident(tenantId, user.id, incidentId, status, { investigatorId, rootCause });
  revalidatePath(`/dashboard/hse/incidents/${incidentId}`);
  revalidatePath("/dashboard/hse/incidents");
}

const CreateCorrectiveActionSchema = z.object({
  incidentId: z.string().optional(),
  inspectionId: z.string().optional(),
  description: z.string().min(2),
  ownerId: z.string().min(1, "Assign an owner"),
  dueDate: z.coerce.date().optional(),
});

export async function createCorrectiveActionAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to raise corrective actions." };
  const parsed = CreateCorrectiveActionSchema.safeParse({ incidentId: formData.get("incidentId") || undefined, inspectionId: formData.get("inspectionId") || undefined, description: formData.get("description"), ownerId: formData.get("ownerId"), dueDate: formData.get("dueDate") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createCorrectiveAction(tenantId, user.id, parsed.data);
  if (parsed.data.incidentId) revalidatePath(`/dashboard/hse/incidents/${parsed.data.incidentId}`);
  revalidatePath("/dashboard/hse/incidents");
  return undefined;
}

export async function transitionCorrectiveActionAction(actionId: string, status: string, incidentId?: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) throw new Error("You do not have permission to update corrective actions.");
  await transitionCorrectiveAction(tenantId, user.id, actionId, status, status === "COMPLETED" ? user.id : undefined);
  if (incidentId) revalidatePath(`/dashboard/hse/incidents/${incidentId}`);
  revalidatePath("/dashboard/hse/incidents");
}

const CreateInductionSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  workerName: z.string().min(2),
  workerCompany: z.string().optional(),
  topicsCovered: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
});

export async function createInductionAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to record inductions." };
  const parsed = CreateInductionSchema.safeParse({ projectId: formData.get("projectId"), workerName: formData.get("workerName"), workerCompany: formData.get("workerCompany") || undefined, topicsCovered: formData.get("topicsCovered") || undefined, expiresAt: formData.get("expiresAt") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createInduction(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/inductions");
  return undefined;
}

const CreateToolboxTalkSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  topic: z.string().min(2),
  notes: z.string().optional(),
  attendeeCount: z.coerce.number().int().min(0).optional(),
});

export async function createToolboxTalkAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to record toolbox talks." };
  const parsed = CreateToolboxTalkSchema.safeParse({ projectId: formData.get("projectId"), topic: formData.get("topic"), notes: formData.get("notes") || undefined, attendeeCount: formData.get("attendeeCount") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createToolboxTalk(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/inductions");
  return undefined;
}

const AddEmergencyContactSchema = z.object({
  projectId: z.string().min(1, "Select a project"),
  name: z.string().min(2),
  role: z.string().optional(),
  phone: z.string().min(2),
  type: z.enum(["AMBULANCE", "FIRE", "POLICE", "HOSPITAL", "SITE_MANAGER", "CLIENT", "OTHER"]).optional(),
  isPrimary: z.coerce.boolean().optional(),
});

export async function addEmergencyContactAction(_prev: HseActionState, formData: FormData): Promise<HseActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "WRITE")) return { error: "You do not have permission to manage emergency contacts." };
  const parsed = AddEmergencyContactSchema.safeParse({ projectId: formData.get("projectId"), name: formData.get("name"), role: formData.get("role") || undefined, phone: formData.get("phone"), type: formData.get("type") || undefined, isPrimary: formData.get("isPrimary") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await addEmergencyContact(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hse/emergency");
  return undefined;
}
