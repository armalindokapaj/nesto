import type { FixtureContext } from "./context";
import { addContractParty, addObligation, updateObligationStatus, addMilestone, updateMilestoneStatus } from "@/server/contracts-module";

export async function seedContractsExtended(ctx: FixtureContext) {
  const { db, tenantId, owner, users } = ctx;
  console.log("Contracts extended (parties, obligations, milestones)…");

  const contract = await db.contract.findFirst({ where: { tenantId } });
  if (!contract) return;
  if (await db.contractParty.findFirst({ where: { tenantId, contractId: contract.id } })) return;

  await addContractParty(tenantId, {
    contractId: contract.id,
    role: "CONTRACTOR",
    legalName: "Elektro Al Shpk",
    partyEntityType: "COMPANY",
    representativeName: "Arjan Beqiri",
    email: "info@elektroal.al",
    signingAuthority: true,
    actorId: owner.id,
  });
  await addContractParty(tenantId, {
    contractId: contract.id,
    role: "CLIENT",
    legalName: "BuildCore Group",
    partyEntityType: "COMPANY",
    representativeName: users.arben.displayName,
    signingAuthority: true,
    actorId: owner.id,
  });
  console.log("  + ContractParty x2 (contractor + client)");

  const obligation1 = await addObligation(tenantId, {
    contractId: contract.id,
    title: "Submit method statement for switchgear installation",
    ownerId: users.gentian.id,
    dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    priority: "HIGH",
    evidenceRequired: true,
    actorId: owner.id,
  });
  const obligation2 = await addObligation(tenantId, {
    contractId: contract.id,
    title: "Provide as-built electrical drawings",
    ownerId: users.elira.id,
    dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    priority: "MEDIUM",
    actorId: owner.id,
  });
  await updateObligationStatus(tenantId, { obligationId: obligation1.id, status: "IN_PROGRESS", actorId: owner.id });
  console.log("  + ContractObligation x2 (one in progress, one overdue)");
  void obligation2;

  const milestone1 = await addMilestone(tenantId, { contractId: contract.id, title: "Switchgear installation complete", plannedAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), paymentTrigger: true, actorId: owner.id });
  const milestone2 = await addMilestone(tenantId, { contractId: contract.id, title: "First fix electrical complete", plannedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), paymentTrigger: true, actorId: owner.id });
  await updateMilestoneStatus(tenantId, { milestoneId: milestone2.id, status: "COMPLETED", actorId: owner.id });
  console.log("  + ContractMilestone x2 (one completed, one pending)");
  void milestone1;
}
