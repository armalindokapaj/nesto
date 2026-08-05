import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

// PRD_Contracts_Module — additive layer on top of the existing thin Contract
// model and src/server/contracts.ts (list/create, untouched). The contract
// lifecycle status machine (src/server/contract-lifecycle.ts, the Audit 2
// reference workflow) is NOT touched by anything here — this only adds
// multi-party support, obligations, milestones, a Star and an activity
// timeline, per §49 Data Ownership Rules.

export { CONTRACT_TYPE_SUGGESTIONS, PARTY_ROLE_SUGGESTIONS, PARTY_ENTITY_TYPES, OBLIGATION_STATUSES, OBLIGATION_PRIORITIES, MILESTONE_STATUSES } from "@/lib/contract-constants";

async function logContractActivity(input: { tenantId: string; contractId: string; actorId?: string | null; eventType: string; summary: string }) {
  await db.contractActivity.create({
    data: {
      tenantId: input.tenantId,
      contractId: input.contractId,
      actorId: input.actorId ?? null,
      eventType: input.eventType,
      summary: input.summary,
    },
  });
}

export async function getContractDetail(tenantId: string, contractId: string, userId: string) {
  const contract = assertTenant(
    await db.contract.findUnique({
      where: { id: contractId },
      include: {
        project: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        responsibleUser: { select: { id: true, displayName: true, avatarColor: true } },
        parties: { orderBy: { createdAt: "asc" } },
        obligations: {
          orderBy: [{ status: "asc" }, { dueAt: "asc" }],
          include: { owner: { select: { id: true, displayName: true, avatarColor: true } }, party: true },
        },
        milestones: { orderBy: { plannedAt: "asc" }, include: { party: true } },
        stars: { where: { userId }, select: { id: true } },
      },
    }),
    tenantId,
    "Contract"
  );

  const activity = await db.contractActivity.findMany({
    where: { tenantId, contractId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { id: true, displayName: true, avatarColor: true } } },
  });

  return { ...contract, isStarred: contract.stars.length > 0, activity };
}

export async function listStarredContractIds(tenantId: string, userId: string) {
  const stars = await db.contractStar.findMany({ where: { tenantId, userId }, select: { contractId: true } });
  return new Set(stars.map((s) => s.contractId));
}

export async function toggleContractStar(tenantId: string, contractId: string, userId: string) {
  assertTenant(await db.contract.findUnique({ where: { id: contractId } }), tenantId, "Contract");
  const existing = await db.contractStar.findUnique({ where: { contractId_userId: { contractId, userId } } });
  if (existing) {
    await db.contractStar.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await db.contractStar.create({ data: { tenantId, contractId, userId } });
  return { starred: true };
}

export async function updateContractDetails(
  tenantId: string,
  input: { contractId: string; contractType?: string | null; responsibleUserId?: string | null }
) {
  assertTenant(await db.contract.findUnique({ where: { id: input.contractId } }), tenantId, "Contract");
  const { contractId, ...data } = input;
  return db.contract.update({ where: { id: contractId }, data });
}

export async function archiveContract(tenantId: string, contractId: string, actorId: string) {
  assertTenant(await db.contract.findUnique({ where: { id: contractId } }), tenantId, "Contract");
  await db.contract.update({ where: { id: contractId }, data: { archivedAt: new Date() } });
  await logContractActivity({ tenantId, contractId, actorId, eventType: "ARCHIVED", summary: "Contract archived" });
}

export async function restoreContract(tenantId: string, contractId: string, actorId: string) {
  assertTenant(await db.contract.findUnique({ where: { id: contractId } }), tenantId, "Contract");
  await db.contract.update({ where: { id: contractId }, data: { archivedAt: null } });
  await logContractActivity({ tenantId, contractId, actorId, eventType: "RESTORED", summary: "Contract restored" });
}

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

export async function addContractParty(
  tenantId: string,
  input: {
    contractId: string;
    role: string;
    legalName: string;
    partyEntityType?: string;
    representativeName?: string;
    email?: string;
    phone?: string;
    signingAuthority?: boolean;
    actorId: string;
  }
) {
  assertTenant(await db.contract.findUnique({ where: { id: input.contractId } }), tenantId, "Contract");
  const { actorId, ...rest } = input;
  const party = await db.contractParty.create({ data: { tenantId, ...rest, legalName: input.legalName.trim() } });
  await logContractActivity({
    tenantId,
    contractId: input.contractId,
    actorId,
    eventType: "PARTY_ADDED",
    summary: `${rest.role} added: ${party.legalName}`,
  });
  return party;
}

export async function removeContractParty(tenantId: string, partyId: string, actorId: string) {
  const party = assertTenant(await db.contractParty.findUnique({ where: { id: partyId } }), tenantId, "ContractParty");
  await db.contractParty.delete({ where: { id: partyId } });
  await logContractActivity({
    tenantId,
    contractId: party.contractId,
    actorId,
    eventType: "PARTY_REMOVED",
    summary: `Party removed: ${party.legalName}`,
  });
}

// ---------------------------------------------------------------------------
// Obligations
// ---------------------------------------------------------------------------

export async function addObligation(
  tenantId: string,
  input: {
    contractId: string;
    title: string;
    partyId?: string;
    ownerId?: string;
    dueAt?: Date;
    priority?: string;
    evidenceRequired?: boolean;
    actorId: string;
  }
) {
  assertTenant(await db.contract.findUnique({ where: { id: input.contractId } }), tenantId, "Contract");
  const { actorId, ...rest } = input;
  const obligation = await db.contractObligation.create({ data: { tenantId, ...rest, title: input.title.trim() } });
  await logContractActivity({
    tenantId,
    contractId: input.contractId,
    actorId,
    eventType: "OBLIGATION_ADDED",
    summary: `Obligation added: ${obligation.title}`,
  });
  return obligation;
}

export async function updateObligationStatus(tenantId: string, input: { obligationId: string; status: string; actorId: string }) {
  const obligation = assertTenant(await db.contractObligation.findUnique({ where: { id: input.obligationId } }), tenantId, "ContractObligation");
  const updated = await db.contractObligation.update({
    where: { id: input.obligationId },
    data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : null },
  });
  await logContractActivity({
    tenantId,
    contractId: obligation.contractId,
    actorId: input.actorId,
    eventType: "OBLIGATION_STATUS_CHANGED",
    summary: `Obligation "${obligation.title}" -> ${input.status}`,
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function addMilestone(
  tenantId: string,
  input: { contractId: string; title: string; plannedAt?: Date; partyId?: string; paymentTrigger?: boolean; actorId: string }
) {
  assertTenant(await db.contract.findUnique({ where: { id: input.contractId } }), tenantId, "Contract");
  const { actorId, ...rest } = input;
  const milestone = await db.contractMilestone.create({ data: { tenantId, ...rest, title: input.title.trim() } });
  await logContractActivity({
    tenantId,
    contractId: input.contractId,
    actorId,
    eventType: "MILESTONE_ADDED",
    summary: `Milestone added: ${milestone.title}`,
  });
  return milestone;
}

export async function updateMilestoneStatus(tenantId: string, input: { milestoneId: string; status: string; actorId: string }) {
  const milestone = assertTenant(await db.contractMilestone.findUnique({ where: { id: input.milestoneId } }), tenantId, "ContractMilestone");
  const updated = await db.contractMilestone.update({
    where: { id: input.milestoneId },
    data: { status: input.status, actualAt: input.status === "COMPLETED" ? new Date() : milestone.actualAt },
  });
  await logContractActivity({
    tenantId,
    contractId: milestone.contractId,
    actorId: input.actorId,
    eventType: "MILESTONE_STATUS_CHANGED",
    summary: `Milestone "${milestone.title}" -> ${input.status}`,
  });
  return updated;
}
