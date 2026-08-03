"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPublicSession, deletePublicSession } from "@/lib/public-session";
import { getCurrentPublicAccount } from "@/lib/public-dal";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  registerPublicAccount,
  authenticatePublicAccount,
  resendVerificationToken,
  verifyEmail,
  updateProfessionalProfile,
  updateContractorProfile,
  addExperience,
  removeExperience,
  addEducation,
  removeEducation,
  addCertification,
  removeCertification,
  addSkill,
  removeSkill,
  addContractorContact,
  removeContractorContact,
  addPortfolioProject,
  removePortfolioProject,
  uploadProfileDocument,
  submitApplication,
  checkDuplicates,
  recordReview,
} from "@/server/public-signup";
import {
  PUBLIC_ACCOUNT_TYPES,
  APPLICATION_REVIEW_ACTIONS,
  PROFILE_DOCUMENT_CATEGORIES,
  PORTFOLIO_PROJECT_STATUSES,
} from "@/lib/constants";

export type ActionState = { error: string } | { success: true; token?: string } | undefined;

function toError(err: unknown): ActionState {
  return { error: err instanceof Error ? err.message : "Something went wrong." };
}

// Empty-string date inputs (an unfilled <input type="date">) must be treated
// as absent, not coerced into an Invalid Date that fails validation.
const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional());

// ---------------------------------------------------------------------------
// Registration / authentication
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  preferredLanguage: z.enum(["en", "sq"]),
  country: z.string().min(1),
  timeZone: z.string().min(1),
  accountType: z.enum(PUBLIC_ACCOUNT_TYPES),
  termsAccepted: z.literal("true", { message: "You must accept the Terms of Service" }),
  privacyAccepted: z.literal("true", { message: "You must accept the Privacy Policy" }),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.password !== parsed.data.confirmPassword) return { error: "Passwords do not match." };

  try {
    const { account, verificationToken } = await registerPublicAccount({
      ...parsed.data,
      termsVersion: "1.0",
      privacyVersion: "1.0",
    });
    await createPublicSession(account.id);
    return { success: true, token: verificationToken };
  } catch (err) {
    return toError(err);
  }
}

const LoginSchema = z.object({ identifier: z.string().min(1), password: z.string().min(1) });
export async function loginPublicAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email/username and password." };

  const account = await authenticatePublicAccount(parsed.data.identifier, parsed.data.password);
  if (!account) return { error: "Invalid credentials." };

  await createPublicSession(account.id);
  redirect("/apply/pending");
}

export async function logoutPublicAction() {
  await deletePublicSession();
  redirect("/apply");
}

export async function resendVerificationAction(): Promise<ActionState> {
  try {
    const account = await getCurrentPublicAccount();
    const token = await resendVerificationToken(account.id);
    return { success: true, token };
  } catch (err) {
    return toError(err);
  }
}

const VerifyEmailSchema = z.object({ token: z.string().min(1) });
export async function verifyEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = VerifyEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid verification link." };
  try {
    await verifyEmail(parsed.data.token);
  } catch (err) {
    return toError(err);
  }
  redirect("/apply/onboarding");
}

// ---------------------------------------------------------------------------
// Profile editing (applicant, own account only — enforced via public session)
// ---------------------------------------------------------------------------

const ProfessionalProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  primaryProfession: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  yearsExperience: z.coerce.number().optional(),
  employmentStatus: z.string().optional(),
  availabilityStatus: z.string().optional(),
  professionalEmail: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  portfolioWebsite: z.string().optional(),
  addressVisibility: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  expectedSalary: z.string().optional(),
  workAuthorization: z.string().optional(),
  noticePeriod: z.string().optional(),
});

export async function updateProfessionalProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const raw = Object.fromEntries(formData);
  const parsed = ProfessionalProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== "" && v !== undefined));
  try {
    await updateProfessionalProfile(account.id, data);
  } catch (err) {
    return toError(err);
  }
  revalidatePath("/apply/onboarding");
  revalidatePath("/apply/pending");
  return undefined;
}

const ContractorProfileSchema = z.object({
  contractorType: z.string().optional(),
  legalBusinessName: z.string().optional(),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  countryOfRegistration: z.string().optional(),
  legalStructure: z.string().optional(),
  foundingYear: z.coerce.number().optional(),
  headquarters: z.string().optional(),
  mainContactPerson: z.string().optional(),
  businessEmail: z.string().optional(),
  businessPhone: z.string().optional(),
  website: z.string().optional(),
  companySize: z.string().optional(),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  primaryService: z.string().optional(),
  countriesServed: z.string().optional(),
  typicalProjectSize: z.string().optional(),
});

export async function updateContractorProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const raw = Object.fromEntries(formData);
  const parsed = ContractorProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== "" && v !== undefined));
  try {
    await updateContractorProfile(account.id, data);
  } catch (err) {
    return toError(err);
  }
  revalidatePath("/apply/onboarding");
  revalidatePath("/apply/pending");
  return undefined;
}

// ---------------------------------------------------------------------------
// Sub-entities (experience, education, certifications, skills, contacts,
// portfolio, documents) — thin authenticated wrappers around server/public-signup.ts
// ---------------------------------------------------------------------------

const ExperienceSchema = z.object({
  employer: z.string().min(1),
  position: z.string().min(1),
  employmentType: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: optionalDate,
  currentlyWorking: z.coerce.boolean().optional(),
  description: z.string().min(1),
});
export async function addExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = ExperienceSchema.safeParse({ ...Object.fromEntries(formData), currentlyWorking: formData.get("currentlyWorking") === "true" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const profile = await getProfessionalProfileOrThrow(account.id);
  await addExperience(profile.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removeExperienceAction(id: string) {
  await getCurrentPublicAccount();
  await removeExperience(id);
  revalidatePath("/apply/onboarding");
}

const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().min(1),
  country: z.string().optional(),
  startDate: z.coerce.date(),
  graduationDate: optionalDate,
  ongoing: z.coerce.boolean().optional(),
});
export async function addEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = EducationSchema.safeParse({ ...Object.fromEntries(formData), ongoing: formData.get("ongoing") === "true" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const profile = await getProfessionalProfileOrThrow(account.id);
  await addEducation(profile.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removeEducationAction(id: string) {
  await getCurrentPublicAccount();
  await removeEducation(id);
  revalidatePath("/apply/onboarding");
}

const CertificationSchema = z.object({
  name: z.string().min(1),
  issuingOrganization: z.string().min(1),
  certificateNumber: z.string().optional(),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  country: z.string().optional(),
  verificationUrl: z.string().optional(),
});
export async function addCertificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = CertificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const profile = await getProfessionalProfileOrThrow(account.id);
  await addCertification(profile.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removeCertificationAction(id: string) {
  await getCurrentPublicAccount();
  await removeCertification(id);
  revalidatePath("/apply/onboarding");
}

const SkillSchema = z.object({ name: z.string().min(1), category: z.enum(["PROFESSIONAL", "SOFTWARE", "LANGUAGE"]), level: z.string().optional() });
export async function addSkillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = SkillSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const profile = await getProfessionalProfileOrThrow(account.id);
  await addSkill(profile.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removeSkillAction(id: string) {
  await getCurrentPublicAccount();
  await removeSkill(id);
  revalidatePath("/apply/onboarding");
}

const ContactSchema = z.object({ name: z.string().min(1), role: z.string().min(1), email: z.string().optional(), phone: z.string().optional() });
export async function addContractorContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = ContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const profile = await getContractorProfileOrThrow(account.id);
  await addContractorContact(profile.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removeContractorContactAction(id: string) {
  await getCurrentPublicAccount();
  await removeContractorContact(id);
  revalidatePath("/apply/onboarding");
}

const PortfolioSchema = z.object({
  title: z.string().min(1),
  projectType: z.string().min(1),
  location: z.string().optional(),
  completionYear: z.coerce.number().optional(),
  clientOrEmployer: z.string().optional(),
  role: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(PORTFOLIO_PROJECT_STATUSES),
  publicVisibility: z.coerce.boolean().default(true),
  ownershipConfirmed: z.literal("true", { message: "Confirm you own or have permission to publish this work." }),
});
export async function addPortfolioProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = PortfolioSchema.safeParse({
    ...Object.fromEntries(formData),
    publicVisibility: formData.get("publicVisibility") !== "false",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await addPortfolioProject(account.id, { ...parsed.data, ownershipConfirmed: true });
  revalidatePath("/apply/onboarding");
  return undefined;
}
export async function removePortfolioProjectAction(id: string) {
  await getCurrentPublicAccount();
  await removePortfolioProject(id);
  revalidatePath("/apply/onboarding");
}

const DocumentSchema = z.object({
  category: z.enum(PROFILE_DOCUMENT_CATEGORIES),
  name: z.string().min(1),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  supersedesId: z.string().optional(),
});
export async function uploadProfileDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await getCurrentPublicAccount();
  const parsed = DocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await uploadProfileDocument(account.id, parsed.data);
  revalidatePath("/apply/onboarding");
  return undefined;
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export async function submitApplicationAction(): Promise<ActionState> {
  try {
    const account = await getCurrentPublicAccount();
    await submitApplication(account.id);
  } catch (err) {
    return toError(err);
  }
  redirect("/apply/pending");
}

export async function getDuplicateWarningsAction() {
  const account = await getCurrentPublicAccount();
  return checkDuplicates(account.id);
}

// ---------------------------------------------------------------------------
// Platform Admin review
// ---------------------------------------------------------------------------

async function requirePlatformAdmin() {
  const { user } = await getCurrentUser();
  if (!user.isPlatformAdmin) throw new Error("You do not have Platform Admin access.");
  return user;
}

const ReviewSchema = z.object({
  publicAccountId: z.string().min(1),
  action: z.enum(APPLICATION_REVIEW_ACTIONS),
  reason: z.string().optional(),
});
export async function reviewApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = ReviewSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    await recordReview(parsed.data.publicAccountId, admin.id, { action: parsed.data.action, reason: parsed.data.reason });
  } catch (err) {
    return toError(err);
  }
  revalidatePath("/platform/applications");
  revalidatePath(`/platform/applications/${(formData.get("publicAccountId") as string) ?? ""}`);
  return undefined;
}

// Callers have already authenticated via getCurrentPublicAccount() and pass
// that account's own id — these just resolve the matching sub-profile row.
async function getProfessionalProfileOrThrow(publicAccountId: string) {
  const profile = await db.professionalProfile.findUnique({ where: { publicAccountId } });
  if (!profile) throw new Error("Professional profile not found.");
  return profile;
}

async function getContractorProfileOrThrow(publicAccountId: string) {
  const profile = await db.contractorProfile.findUnique({ where: { publicAccountId } });
  if (!profile) throw new Error("Contractor profile not found.");
  return profile;
}
