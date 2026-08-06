import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_HR_Payroll_Workforce — Recruitment, the remaining slice of that PRD's
// Phase-1 "HR foundation". See the schema comment above Vacancy for the
// scope decision (pipeline only, no onboarding plan, no automatic hire ->
// Employee conversion).

export async function listVacancies(tenantId: string) {
  const vacancies = await db.vacancy.findMany({
    where: { tenantId },
    include: { candidates: { select: { id: true, stage: true } } },
    orderBy: { createdAt: "desc" },
  });
  return vacancies.map((v) => ({
    ...v,
    candidateCount: v.candidates.length,
    hiredCount: v.candidates.filter((c) => c.stage === "HIRED").length,
  }));
}

export async function createVacancy(tenantId: string, actorId: string, input: { title: string; department?: string; position?: string; headcount?: number }) {
  return db.vacancy.create({ data: { tenantId, openedById: actorId, ...input } });
}

const VACANCY_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["ON_HOLD", "FILLED", "CANCELLED"],
  ON_HOLD: ["OPEN", "CANCELLED"],
  FILLED: [],
  CANCELLED: [],
};

export async function setVacancyStatus(tenantId: string, vacancyId: string, status: string) {
  const vacancy = assertTenant(await db.vacancy.findUnique({ where: { id: vacancyId } }), tenantId, "Vacancy");
  if (!VACANCY_TRANSITIONS[vacancy.status]?.includes(status)) {
    throw new Error(`Cannot move a ${vacancy.status} vacancy to ${status}.`);
  }
  return db.vacancy.update({ where: { id: vacancy.id }, data: { status } });
}

export async function getVacancy(tenantId: string, vacancyId: string) {
  const vacancy = assertTenant(
    await db.vacancy.findUnique({
      where: { id: vacancyId },
      include: {
        candidates: {
          orderBy: { createdAt: "desc" },
          include: { offers: { orderBy: { extendedAt: "desc" } } },
        },
      },
    }),
    tenantId,
    "Vacancy"
  );
  return vacancy;
}

// ---------------------------------------------------------------------------
// Candidates — pipeline stage changes are immutable-by-construction: every
// change appends a CandidateStageEvent and updates Candidate.stage together.
// ---------------------------------------------------------------------------

export async function createCandidate(
  tenantId: string,
  actorId: string,
  input: { vacancyId: string; fullName: string; email?: string; phone?: string; source?: string }
) {
  const vacancy = assertTenant(await db.vacancy.findUnique({ where: { id: input.vacancyId } }), tenantId, "Vacancy");
  const candidate = await db.candidate.create({ data: { tenantId, addedById: actorId, ...input, vacancyId: vacancy.id } });
  await db.candidateStageEvent.create({
    data: { tenantId, candidateId: candidate.id, fromStage: null, toStage: "APPLIED", actedById: actorId },
  });
  return candidate;
}

const CANDIDATE_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ["SCREENING", "REJECTED"],
  SCREENING: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["OFFER", "REJECTED"],
  OFFER: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
};

export async function setCandidateStage(tenantId: string, actorId: string, candidateId: string, toStage: string, note?: string) {
  const candidate = assertTenant(await db.candidate.findUnique({ where: { id: candidateId } }), tenantId, "Candidate");
  if (!CANDIDATE_TRANSITIONS[candidate.stage]?.includes(toStage)) {
    throw new Error(`Cannot move a ${candidate.stage} candidate to ${toStage}.`);
  }
  const [, updated] = await db.$transaction([
    db.candidateStageEvent.create({ data: { tenantId, candidateId: candidate.id, fromStage: candidate.stage, toStage, note, actedById: actorId } }),
    db.candidate.update({ where: { id: candidate.id }, data: { stage: toStage } }),
  ]);
  return updated;
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function createOffer(
  tenantId: string,
  actorId: string,
  input: { candidateId: string; position: string; compensation?: number; currency?: string }
) {
  const candidate = assertTenant(await db.candidate.findUnique({ where: { id: input.candidateId } }), tenantId, "Candidate");
  if (candidate.stage !== "OFFER") throw new Error("Move the candidate to the Offer stage before extending an offer.");
  return db.offer.create({ data: { tenantId, extendedById: actorId, status: "SENT", ...input, candidateId: candidate.id } });
}

const OFFER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "WITHDRAWN"],
  SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: [],
  DECLINED: [],
  WITHDRAWN: [],
};

export async function setOfferStatus(tenantId: string, actorId: string, offerId: string, status: string) {
  const offer = assertTenant(await db.offer.findUnique({ where: { id: offerId } }), tenantId, "Offer");
  if (!OFFER_TRANSITIONS[offer.status]?.includes(status)) {
    throw new Error(`Cannot move a ${offer.status} offer to ${status}.`);
  }
  const updated = await db.offer.update({ where: { id: offer.id }, data: { status, respondedAt: ["ACCEPTED", "DECLINED"].includes(status) ? new Date() : offer.respondedAt } });
  // An accepted offer moves its candidate to HIRED — the one automatic stage
  // transition in the pipeline, since it's the offer's own resolution, not a
  // separate HR decision. Everything downstream (creating the Employee /
  // EmploymentRelationship record) is still a deliberate, manual HR action.
  if (status === "ACCEPTED") {
    await setCandidateStage(tenantId, actorId, offer.candidateId, "HIRED", "Offer accepted");
  }
  return updated;
}
