import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { allocatePlatformNumber } from "@/server/platform-number-series";
import type { ApplicationReviewAction, PublicAccountStatus, PublicAccountType } from "@/lib/constants";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

async function recordAuditEvent(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: {
    publicAccountId: string;
    actorType: "APPLICANT" | "PLATFORM_ADMIN" | "SYSTEM";
    actorId?: string | null;
    eventType: string;
    summary: string;
    previousStatus?: string | null;
    newStatus?: string | null;
  }
) {
  return tx.profileAuditEvent.create({
    data: {
      publicAccountId: input.publicAccountId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Registration and email verification
// ---------------------------------------------------------------------------

export async function registerPublicAccount(input: {
  email: string;
  username: string;
  password: string;
  preferredLanguage: string;
  country: string;
  timeZone: string;
  accountType: PublicAccountType;
  termsVersion: string;
  privacyVersion: string;
}) {
  const existingEmail = await db.publicAccount.findUnique({ where: { email: input.email } });
  if (existingEmail) throw new Error("An account with this email already exists.");
  const existingUsername = await db.publicAccount.findUnique({ where: { username: input.username } });
  if (existingUsername) throw new Error("This username is already taken.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const token = crypto.randomBytes(32).toString("hex");

  return db.$transaction(async (tx) => {
    const account = await tx.publicAccount.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        preferredLanguage: input.preferredLanguage,
        country: input.country,
        timeZone: input.timeZone,
        accountType: input.accountType,
        status: "EMAIL_VERIFICATION_REQUIRED",
        termsAcceptedAt: new Date(),
        termsVersion: input.termsVersion,
        privacyAcceptedAt: new Date(),
        privacyVersion: input.privacyVersion,
      },
    });

    if (input.accountType === "PROFESSIONAL") {
      await tx.professionalProfile.create({ data: { publicAccountId: account.id } });
    } else {
      await tx.contractorProfile.create({ data: { publicAccountId: account.id } });
    }

    await tx.emailVerificationToken.create({
      data: { publicAccountId: account.id, token, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) },
    });

    await recordAuditEvent(tx, {
      publicAccountId: account.id,
      actorType: "APPLICANT",
      actorId: account.id,
      eventType: "ACCOUNT_CREATED",
      summary: `Account created as ${input.accountType.toLowerCase()}.`,
      newStatus: "EMAIL_VERIFICATION_REQUIRED",
    });

    return { account, verificationToken: token };
  });
}

// No email provider is wired anywhere in this app (established precedent —
// see landing page's Forgot Password flow). The verification link is
// surfaced directly in the UI after registration/resend rather than emailed.
export async function resendVerificationToken(publicAccountId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.emailVerificationToken.updateMany({
    where: { publicAccountId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await db.emailVerificationToken.create({
    data: { publicAccountId, token, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) },
  });
  return token;
}

export async function verifyEmail(token: string) {
  const record = await db.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    throw new Error("This verification link is invalid or has expired.");
  }

  return db.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    const account = await tx.publicAccount.update({
      where: { id: record.publicAccountId },
      data: { emailVerified: true, emailVerifiedAt: new Date(), status: "PROFILE_INCOMPLETE" },
    });
    await recordAuditEvent(tx, {
      publicAccountId: account.id,
      actorType: "APPLICANT",
      actorId: account.id,
      eventType: "EMAIL_VERIFIED",
      summary: "Email address verified.",
      previousStatus: "EMAIL_VERIFICATION_REQUIRED",
      newStatus: "PROFILE_INCOMPLETE",
    });
    return account;
  });
}

export async function authenticatePublicAccount(identifier: string, password: string) {
  const account = await db.publicAccount.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  const passwordHash = account?.passwordHash ?? "$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal";
  const valid = await bcrypt.compare(password, passwordHash);
  if (!account || !valid) return null;
  return account;
}

// ---------------------------------------------------------------------------
// Profile reads
// ---------------------------------------------------------------------------

export async function getPublicAccountFull(publicAccountId: string) {
  return db.publicAccount.findUnique({
    where: { id: publicAccountId },
    include: {
      professionalProfile: { include: { experiences: true, educations: true, certifications: true, skills: true } },
      contractorProfile: { include: { contacts: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      portfolioProjects: { orderBy: { createdAt: "desc" } },
      application: { include: { reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: true } } } },
      auditEvents: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type PublicAccountFull = NonNullable<Awaited<ReturnType<typeof getPublicAccountFull>>>;

// ---------------------------------------------------------------------------
// Profile section updates (draft-safe — allowed while pending too, per §12.2)
// ---------------------------------------------------------------------------

export async function updateProfessionalProfile(publicAccountId: string, data: Record<string, unknown>) {
  await db.professionalProfile.update({ where: { publicAccountId }, data });
  await recomputeStatus(publicAccountId);
}

export async function updateContractorProfile(publicAccountId: string, data: Record<string, unknown>) {
  await db.contractorProfile.update({ where: { publicAccountId }, data });
  await recomputeStatus(publicAccountId);
}

export async function addExperience(profileId: string, data: { employer: string; position: string; employmentType?: string; country?: string; city?: string; startDate: Date; endDate?: Date; currentlyWorking?: boolean; description: string }) {
  return db.professionalExperience.create({ data: { profileId, ...data } });
}
export async function removeExperience(id: string) {
  return db.professionalExperience.delete({ where: { id } });
}

export async function addEducation(profileId: string, data: { institution: string; degree: string; fieldOfStudy: string; country?: string; startDate: Date; graduationDate?: Date; ongoing?: boolean }) {
  return db.professionalEducation.create({ data: { profileId, ...data } });
}
export async function removeEducation(id: string) {
  return db.professionalEducation.delete({ where: { id } });
}

export async function addCertification(profileId: string, data: { name: string; issuingOrganization: string; certificateNumber?: string; issueDate?: Date; expiryDate?: Date; country?: string; verificationUrl?: string }) {
  return db.professionalCertification.create({ data: { profileId, ...data } });
}
export async function removeCertification(id: string) {
  return db.professionalCertification.delete({ where: { id } });
}

export async function addSkill(profileId: string, data: { name: string; category: string; level?: string }) {
  return db.professionalSkill.create({ data: { profileId, ...data } });
}
export async function removeSkill(id: string) {
  return db.professionalSkill.delete({ where: { id } });
}

export async function addContractorContact(profileId: string, data: { name: string; role: string; email?: string; phone?: string }) {
  return db.contractorContact.create({ data: { profileId, ...data } });
}
export async function removeContractorContact(id: string) {
  return db.contractorContact.delete({ where: { id } });
}

export async function addPortfolioProject(
  publicAccountId: string,
  data: {
    title: string;
    projectType: string;
    location?: string;
    completionYear?: number;
    clientOrEmployer?: string;
    role: string;
    description: string;
    status: string;
    coverImageUrl?: string;
    publicVisibility: boolean;
    ownershipConfirmed: boolean;
  }
) {
  const project = await db.portfolioProject.create({ data: { publicAccountId, ...data } });
  await recomputeStatus(publicAccountId);
  return project;
}
export async function removePortfolioProject(id: string) {
  return db.portfolioProject.delete({ where: { id } });
}

// A changed upload creates a new revision rather than overwriting — same
// discipline as DocumentFile/ProfileDocument elsewhere in this app.
export async function uploadProfileDocument(
  publicAccountId: string,
  data: { category: string; name: string; visibility?: string; issueDate?: Date; expiryDate?: Date; supersedesId?: string }
) {
  const doc = await db.profileDocument.create({
    data: {
      publicAccountId,
      category: data.category,
      name: data.name,
      visibility: data.visibility ?? "PRIVATE",
      issueDate: data.issueDate,
      expiryDate: data.expiryDate,
      supersedesId: data.supersedesId,
      version: data.supersedesId ? 2 : 1,
    },
  });
  if (data.supersedesId) {
    await db.profileDocument.update({ where: { id: data.supersedesId }, data: { isActive: false } });
  }
  await recomputeStatus(publicAccountId);
  return doc;
}

// ---------------------------------------------------------------------------
// Completion / readiness
// ---------------------------------------------------------------------------

export async function computeCompletion(publicAccountId: string): Promise<{ percentage: number; missing: string[] }> {
  const account = await getPublicAccountFull(publicAccountId);
  if (!account) return { percentage: 0, missing: ["account"] };

  const missing: string[] = [];
  let total = 0;
  let done = 0;

  const check = (label: string, ok: boolean) => {
    total += 1;
    if (ok) done += 1;
    else missing.push(label);
  };

  if (account.accountType === "PROFESSIONAL") {
    const p = account.professionalProfile;
    check("First and last name", !!(p?.firstName && p?.lastName));
    check("Professional title", !!p?.title);
    check("Primary profession", !!p?.primaryProfession);
    check("Country and city", !!(p?.country && p?.city));
    check("Professional headline", !!p?.headline);
    check("Professional summary", !!p?.summary);
    check("Years of experience", p?.yearsExperience != null);
    check("Employment status", !!p?.employmentStatus);
    check("Availability status", !!p?.availabilityStatus);
    check("Professional email", !!p?.professionalEmail);
    check("At least one skill", (p?.skills.length ?? 0) > 0);
    check("CV uploaded", account.documents.some((d) => d.category === "CV" && d.isActive));
  } else {
    const c = account.contractorProfile;
    check("Contractor type", !!c?.contractorType);
    check("Legal business name", !!c?.legalBusinessName);
    check("Country of registration", !!c?.countryOfRegistration);
    check("Headquarters", !!c?.headquarters);
    check("Main contact person", !!c?.mainContactPerson);
    check("Business email", !!c?.businessEmail);
    check("Primary service", !!c?.primaryService);
    check("Countries served", !!c?.countriesServed);
    check("Company/CV profile document uploaded", account.documents.some((d) => (d.category === "CV" || d.category === "COMPANY_PROFILE") && d.isActive));
  }

  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  return { percentage, missing };
}

async function recomputeStatus(publicAccountId: string) {
  const account = await db.publicAccount.findUnique({ where: { id: publicAccountId } });
  if (!account || !account.emailVerified) return;
  // Only auto-advance the "still building the draft" states — once
  // submitted, pending, or decided, edits must not silently change status
  // (§12.4 — major changes explicitly re-flag sections, they don't just
  // reset the whole application).
  if (!["PROFILE_INCOMPLETE", "READY_TO_SUBMIT"].includes(account.status)) return;

  const { percentage } = await computeCompletion(publicAccountId);
  const nextStatus: PublicAccountStatus = percentage === 100 ? "READY_TO_SUBMIT" : "PROFILE_INCOMPLETE";
  if (nextStatus !== account.status) {
    await db.publicAccount.update({ where: { id: publicAccountId }, data: { status: nextStatus } });
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection (§22) — flagged for Platform Admin review, never
// auto-merged or auto-blocked.
// ---------------------------------------------------------------------------

export async function checkDuplicates(publicAccountId: string) {
  const account = await getPublicAccountFull(publicAccountId);
  if (!account) return [];

  const matches = new Map<string, { id: string; label: string; reason: string }>();

  if (account.accountType === "PROFESSIONAL" && account.professionalProfile?.phone) {
    const byPhone = await db.professionalProfile.findMany({
      where: { phone: account.professionalProfile.phone, publicAccountId: { not: publicAccountId } },
      include: { publicAccount: true },
    });
    byPhone.forEach((p) => matches.set(p.publicAccountId, { id: p.publicAccountId, label: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.publicAccount.email, reason: "Same phone number" }));
  }

  if (account.accountType === "CONTRACTOR" && account.contractorProfile) {
    const c = account.contractorProfile;
    const orClauses = [
      c.legalBusinessName ? { legalBusinessName: c.legalBusinessName } : null,
      c.registrationNumber ? { registrationNumber: c.registrationNumber } : null,
      c.vatNumber ? { vatNumber: c.vatNumber } : null,
      c.website ? { website: c.website } : null,
    ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

    if (orClauses.length > 0) {
      const byBusiness = await db.contractorProfile.findMany({
        where: { OR: orClauses, publicAccountId: { not: publicAccountId } },
        include: { publicAccount: true },
      });
      byBusiness.forEach((cp) =>
        matches.set(cp.publicAccountId, { id: cp.publicAccountId, label: cp.legalBusinessName ?? cp.publicAccount.email, reason: "Matching business registration details" })
      );
    }
  }

  return Array.from(matches.values());
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export async function submitApplication(publicAccountId: string) {
  const account = await db.publicAccount.findUnique({ where: { id: publicAccountId } });
  if (!account) throw new Error("Account not found.");

  const { percentage, missing } = await computeCompletion(publicAccountId);
  if (percentage < 100) {
    throw new Error(`Profile is incomplete: ${missing.join(", ")}`);
  }

  const isResubmission = account.status === "CHANGES_REQUESTED";
  const applicationNumber = isResubmission ? undefined : await allocatePlatformNumber("APPLICATION");
  const newStatus: PublicAccountStatus = isResubmission ? "RESUBMITTED" : "PENDING_PLATFORM_REVIEW";

  return db.$transaction(async (tx) => {
    if (isResubmission) {
      await tx.profileApplication.update({ where: { publicAccountId }, data: { status: "RESUBMITTED", submittedAt: new Date() } });
    } else {
      await tx.profileApplication.create({
        data: { publicAccountId, applicationNumber: applicationNumber!, status: "PENDING_PLATFORM_REVIEW" },
      });
    }
    await tx.publicAccount.update({ where: { id: publicAccountId }, data: { status: newStatus } });
    await recordAuditEvent(tx, {
      publicAccountId,
      actorType: "APPLICANT",
      actorId: publicAccountId,
      eventType: isResubmission ? "APPLICATION_RESUBMITTED" : "APPLICATION_SUBMITTED",
      summary: isResubmission ? "Applicant resubmitted after requested changes." : "Application submitted for Platform Admin review.",
      previousStatus: account.status,
      newStatus,
    });
  });
}

// ---------------------------------------------------------------------------
// Platform Admin review (§13-17)
// ---------------------------------------------------------------------------

export async function listApplications(filters: { status?: string; accountType?: string }) {
  return db.publicAccount.findMany({
    where: {
      status: { in: ["PENDING_PLATFORM_REVIEW", "RESUBMITTED", "CHANGES_REQUESTED", "APPROVED", "APPROVED_WITH_RESTRICTIONS", "REJECTED", "SUSPENDED"] },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.accountType ? { accountType: filters.accountType } : {}),
    },
    include: {
      professionalProfile: true,
      contractorProfile: true,
      application: { include: { reviewer: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

const STATUS_BY_ACTION: Record<ApplicationReviewAction, PublicAccountStatus> = {
  APPROVE: "APPROVED",
  APPROVE_WITH_RESTRICTIONS: "APPROVED_WITH_RESTRICTIONS",
  REQUEST_CHANGES: "CHANGES_REQUESTED",
  REQUEST_DOCUMENTS: "CHANGES_REQUESTED",
  REJECT: "REJECTED",
  SUSPEND: "SUSPENDED",
  REACTIVATE: "APPROVED",
};

export async function recordReview(
  publicAccountId: string,
  reviewerId: string,
  input: { action: ApplicationReviewAction; reason?: string; fieldsRequested?: string[]; restrictions?: string[] }
) {
  const account = await db.publicAccount.findUnique({ where: { id: publicAccountId }, include: { application: true } });
  if (!account?.application) throw new Error("No application found for this account.");
  if ((input.action === "REJECT" || input.action === "REQUEST_CHANGES" || input.action === "REQUEST_DOCUMENTS") && !input.reason) {
    throw new Error("A reason is required for this decision.");
  }

  const nextStatus = STATUS_BY_ACTION[input.action];
  const isApproval = input.action === "APPROVE" || input.action === "APPROVE_WITH_RESTRICTIONS";

  // allocatePlatformNumber() runs its own short transaction — it can't be
  // nested inside the one below (SQLite via Prisma doesn't support
  // concurrent/nested transactions on one connection), so it must be
  // allocated first, same pattern as PRD_4's task-code allocation.
  let approvedProfileNumber = account.application!.approvedProfileNumber;
  if (isApproval && !approvedProfileNumber) {
    approvedProfileNumber = await allocatePlatformNumber("PROFILE");
  }

  return db.$transaction(async (tx) => {
    await tx.applicationReview.create({
      data: {
        applicationId: account.application!.id,
        reviewerId,
        action: input.action,
        reason: input.reason,
        fieldsRequested: input.fieldsRequested ? JSON.stringify(input.fieldsRequested) : null,
      },
    });

    await tx.profileApplication.update({
      where: { id: account.application!.id },
      data: {
        status: nextStatus,
        reviewerId,
        decisionReason: input.reason,
        decidedAt: new Date(),
        restrictions: input.restrictions ? JSON.stringify(input.restrictions) : null,
        approvedProfileNumber,
      },
    });

    await tx.publicAccount.update({ where: { id: publicAccountId }, data: { status: nextStatus } });

    await recordAuditEvent(tx, {
      publicAccountId,
      actorType: "PLATFORM_ADMIN",
      actorId: reviewerId,
      eventType: `REVIEW_${input.action}`,
      summary: `Platform Admin: ${input.action.replace(/_/g, " ").toLowerCase()}${input.reason ? ` — ${input.reason}` : ""}`,
      previousStatus: account.status,
      newStatus: nextStatus,
    });

    return tx.profileApplication.findUnique({ where: { id: account.application!.id } });
  });
}
