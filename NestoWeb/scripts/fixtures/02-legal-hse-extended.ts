import type { FixtureContext } from "./context";
import { createLegalCase, grantCaseAccess, createLegalHold } from "@/server/legal";
import {
  createIncident,
  transitionIncident,
  createCorrectiveAction,
  createInduction,
  createToolboxTalk,
  createInspection,
  createObservation,
  issueStopWorkOrder,
  releaseStopWorkOrder,
  addEmergencyContact,
} from "@/server/hse";

export async function seedLegalHseExtended(ctx: FixtureContext) {
  const { db, tenantId, owner, projects, roleAccount } = ctx;
  console.log("Legal & HSE extended (Cases, Holds, Incidents, Inductions, Stop-Work)…");

  // --- Legal Cases & Holds ---------------------------------------------------
  if (!(await db.legalCase.findFirst({ where: { tenantId } }))) {
    const dispute = await createLegalCase(tenantId, owner.id, {
      title: "Facade material delay dispute",
      caseType: "DISPUTE",
      projectId: projects.riverside.id,
      counterparty: "VitroFasada Glazing",
      summary: "Contractor disputes liquidated damages for a 3-week facade material delay.",
      confidentialityTier: "STANDARD",
    });
    console.log("  + LegalCase (STANDARD): Facade material delay dispute");

    const privileged = await createLegalCase(tenantId, owner.id, {
      title: "Pre-litigation opinion — Skyline Apartments delay claim",
      caseType: "LITIGATION",
      projectId: projects.skyline.id,
      counterparty: "Skyline Developers",
      summary: "Outside counsel opinion on exposure ahead of a possible delay damages claim.",
      confidentialityTier: "LEGAL_PRIVILEGED",
    });
    // Grant the seeded "Legal" role test account explicit access — demonstrates
    // the confidentiality-tier gate (a LEGAL/READ role alone can't see this).
    try {
      const legalAccount = await roleAccount("Legal");
      await grantCaseAccess(tenantId, owner.id, privileged.id, legalAccount.id);
      console.log("  + LegalCase (LEGAL_PRIVILEGED) + access grant to the 'Legal' test account");
    } catch {
      console.log("  + LegalCase (LEGAL_PRIVILEGED), no grant (Legal test account not found)");
    }

    await createLegalHold(tenantId, owner.id, {
      caseId: dispute.id,
      scope: "All correspondence and delivery records related to the VitroFasada glazing package",
    });
    console.log("  + LegalHold on the dispute case");
  }

  // --- HSE: Incidents, Inductions, Toolbox Talks, Inspections, Observations -
  if (!(await db.hseIncident.findFirst({ where: { tenantId } }))) {
    const incident = await createIncident(tenantId, owner.id, {
      projectId: projects.riverside.id,
      classification: "NEAR_MISS",
      title: "Dropped tool near active walkway",
      description: "A hand tool fell from level 4 scaffolding, landing in a barricaded exclusion zone. No injury.",
      occurredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      location: "Tower A · Level 4",
    });
    await transitionIncident(tenantId, owner.id, incident.id, "UNDER_INVESTIGATION", { investigatorId: owner.id });
    await transitionIncident(tenantId, owner.id, incident.id, "CLOSED", { rootCause: "Tool lanyard not used per method statement." });
    await createCorrectiveAction(tenantId, owner.id, {
      incidentId: incident.id,
      description: "Re-brief all scaffolding crews on mandatory tool-lanyard use.",
      ownerId: owner.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log("  + HseIncident (closed, near-miss) + corrective action");

    for (const p of [projects.riverside, projects.metroMall, projects.skyline]) {
      await createInduction(tenantId, owner.id, { projectId: p.id, workerName: "New Site Worker", workerCompany: "BuildCore Structures", topicsCovered: "Site rules, PPE, emergency assembly points, permit-to-work basics" });
    }
    console.log("  + Site inductions for 3 projects");

    await createToolboxTalk(tenantId, owner.id, { projectId: projects.riverside.id, topic: "Working at height — guardrail inspection", attendeeCount: 12 });
    await createToolboxTalk(tenantId, owner.id, { projectId: projects.metroMall.id, topic: "Manual handling and lifting technique", attendeeCount: 18 });
    console.log("  + Toolbox talks");

    const inspection = await createInspection(tenantId, owner.id, { projectId: projects.riverside.id, type: "SCAFFOLDING", location: "Tower A · Levels 3-5", findings: "Two tags missing on level 4 access towers." });
    await createInspection(tenantId, owner.id, { projectId: projects.metroMall.id, type: "ELECTRICAL", location: "MEP riser room", findings: "Temporary distribution board correctly tagged and tested.", outcome: "PASS" });
    await createCorrectiveAction(tenantId, owner.id, { inspectionId: inspection.id, description: "Re-tag levels 4 access towers before next shift.", ownerId: owner.id, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });
    console.log("  + Inspections + corrective action");

    await createObservation(tenantId, owner.id, { projectId: projects.riverside.id, type: "UNSAFE_CONDITION", description: "Housekeeping — offcuts accumulating near stair core.", location: "Tower A · Level 3", severity: "LOW" });
    await createObservation(tenantId, owner.id, { projectId: projects.skyline.id, type: "POSITIVE", description: "Crew observed using full fall-arrest kit correctly at height.", location: "Block B roof edge" });
    console.log("  + Safety observations");

    await addEmergencyContact(tenantId, owner.id, { projectId: projects.riverside.id, name: "Tirana Fire Brigade", phone: "112", type: "FIRE", isPrimary: true });
    await addEmergencyContact(tenantId, owner.id, { projectId: projects.riverside.id, name: "Site First Aid — Besnik Lala", phone: "+355 69 200 9911", type: "MEDICAL", isPrimary: true });
    console.log("  + Emergency contacts");
  }

  // --- Stop-Work Order: one issued-and-released, so the release/audit trail is visible ---
  if (!(await db.stopWorkOrder.findFirst({ where: { tenantId } }))) {
    const order = await issueStopWorkOrder(tenantId, owner.id, {
      projectId: projects.skyline.id,
      scopeType: "ZONE",
      scopeRef: "Block B — Level 2 slab edge",
      reason: "Missing edge protection identified during walk-down; work paused pending guardrail installation.",
    });
    await releaseStopWorkOrder(tenantId, owner.id, order.id, "Guardrail installed and re-inspected; cleared to resume.");
    console.log("  + StopWorkOrder (issued and released)");
  }
}
