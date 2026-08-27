"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { assertConfigEnabled } from "@/server/platform-config";
import {
  createVacancy,
  setVacancyStatus,
  createCandidate,
  setCandidateStage,
  createOffer,
  setOfferStatus,
} from "@/server/recruitment";
import { toActionError } from "@/lib/errors";

export type RecruitmentActionState = { error: string } | undefined;

function requireWrite(role: Role) {
  if (!can(role, "HR", "WRITE")) return "You do not have permission to manage recruitment.";
  return null;
}

const CreateVacancySchema = z.object({
  title: z.string().min(1, "Enter a vacancy title"),
  department: z.string().optional(),
  position: z.string().optional(),
  headcount: z.coerce.number().int().min(1).optional(),
});

export async function createVacancyAction(_prev: RecruitmentActionState, formData: FormData): Promise<RecruitmentActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_vacancy");
  const parsed = CreateVacancySchema.safeParse({
    title: formData.get("title"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    headcount: formData.get("headcount") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createVacancy(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/hr/recruitment");
  return undefined;
}

export async function setVacancyStatusAction(vacancyId: string, status: string): Promise<RecruitmentActionState> {
  const { tenantId, role } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  try {
    await setVacancyStatus(tenantId, vacancyId, status);
  } catch (e) {
    return { error: toActionError(e, "Could not update vacancy.") };
  }
  revalidatePath("/dashboard/hr/recruitment");
  revalidatePath(`/dashboard/hr/recruitment/${vacancyId}`);
  return undefined;
}

const CreateCandidateSchema = z.object({
  vacancyId: z.string().min(1),
  fullName: z.string().min(1, "Enter a candidate name"),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
});

export async function createCandidateAction(_prev: RecruitmentActionState, formData: FormData): Promise<RecruitmentActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_candidate");
  const parsed = CreateCandidateSchema.safeParse({
    vacancyId: formData.get("vacancyId"),
    fullName: formData.get("fullName"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    source: formData.get("source") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await createCandidate(tenantId, user.id, parsed.data);
  revalidatePath(`/dashboard/hr/recruitment/${parsed.data.vacancyId}`);
  return undefined;
}

export async function setCandidateStageAction(candidateId: string, vacancyId: string, toStage: string): Promise<RecruitmentActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_candidate");
  try {
    await setCandidateStage(tenantId, user.id, candidateId, toStage);
  } catch (e) {
    return { error: toActionError(e, "Could not update candidate.") };
  }
  revalidatePath(`/dashboard/hr/recruitment/${vacancyId}`);
  return undefined;
}

const CreateOfferSchema = z.object({
  candidateId: z.string().min(1),
  position: z.string().min(1, "Enter the offered position"),
  compensation: z.coerce.number().optional(),
  currency: z.enum(["EUR", "ALL"]).optional(),
});

export async function createOfferAction(_prev: RecruitmentActionState, formData: FormData): Promise<RecruitmentActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_offer");
  const parsed = CreateOfferSchema.safeParse({
    candidateId: formData.get("candidateId"),
    position: formData.get("position"),
    compensation: formData.get("compensation") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    await createOffer(tenantId, user.id, parsed.data);
  } catch (e) {
    return { error: toActionError(e, "Could not create offer.") };
  }
  revalidatePath(`/dashboard/hr/recruitment/${formData.get("vacancyId")}`);
  return undefined;
}

export async function setOfferStatusAction(offerId: string, vacancyId: string, status: string): Promise<RecruitmentActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  const err = requireWrite(role);
  if (err) return { error: err };
  await assertConfigEnabled(tenantId, "hr.action.manage_offer");
  try {
    await setOfferStatus(tenantId, user.id, offerId, status);
  } catch (e) {
    return { error: toActionError(e, "Could not update offer.") };
  }
  revalidatePath(`/dashboard/hr/recruitment/${vacancyId}`);
  return undefined;
}
