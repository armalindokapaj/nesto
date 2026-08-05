// One-off, idempotent demo-data seed for the HR/Legal/HSE Phase-1 additions.
// Deliberately NOT merged into prisma/seed.ts (which another in-progress
// session has open with unrelated uncommitted edits) — run directly with:
//   npx tsx scripts/seed-hr-legal-hse.ts
// Safe to re-run: every insert is guarded by a findFirst check first.
import { PrismaClient } from "../src/generated/prisma";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found — skipping (run the main seed first).");
    return;
  }
  const tenantId = tenant.id;

  const owner = await db.userIdentity.findFirst({
    where: { memberships: { some: { tenantId, role: { in: ["OWNER", "ADMIN"] } } } },
  });
  if (!owner) {
    console.log("No Owner/Admin user found — skipping.");
    return;
  }

  // --- HR: EmploymentRelationship for existing employees ------------------
  const employees = await db.employee.findMany({ where: { tenantId }, take: 3 });
  for (const employee of employees) {
    const existing = await db.employmentRelationship.findFirst({ where: { tenantId, employeeId: employee.id } });
    if (existing) continue;
    await db.employmentRelationship.create({
      data: {
        tenantId,
        employeeId: employee.id,
        employmentType: "EMPLOYEE",
        contractType: "FULL_TIME",
        jobTitle: employee.position,
        department: employee.department,
        effectiveStartDate: employee.hireDate,
        confidentialityZone: "INTERNAL_PROFESSIONAL",
        createdById: owner.id,
      },
    });
    console.log(`EmploymentRelationship seeded for ${employee.fullName}`);
  }

  // --- Legal: Authority + Permit + Readiness Gate --------------------------
  const projects = await db.project.findMany({ where: { tenantId }, take: 2 });

  let authority = await db.legalAuthority.findFirst({ where: { tenantId, name: "Municipal Building Authority" } });
  if (!authority) {
    authority = await db.legalAuthority.create({
      data: { tenantId, name: "Municipal Building Authority", category: "MUNICIPAL", contactInfo: "permits@municipality.example" },
    });
    console.log("LegalAuthority seeded: Municipal Building Authority");
  }

  for (const project of projects) {
    const existingPermit = await db.permit.findFirst({ where: { tenantId, projectId: project.id } });
    if (!existingPermit) {
      const permit = await db.permit.create({
        data: {
          tenantId,
          projectId: project.id,
          authorityId: authority.id,
          permitType: "BUILDING",
          referenceNumber: `BLD-${project.code}`,
          status: "ISSUED",
          issuedDate: new Date(),
          createdById: owner.id,
        },
      });
      await db.legalActivity.create({
        data: { tenantId, entityType: "Permit", entityId: permit.id, actorId: owner.id, eventType: "CREATED", summary: `Permit ${permit.permitType} drafted` },
      });
      console.log(`Permit seeded for project ${project.name}`);
    }

    const existingGate = await db.legalReadinessStatus.findUnique({ where: { projectId: project.id } });
    if (!existingGate) {
      await db.legalReadinessStatus.create({
        data: { tenantId, projectId: project.id, status: "READY", reason: "Building permit issued; no open legal obligations.", setById: owner.id },
      });
      console.log(`Legal Readiness Gate seeded for project ${project.name}`);
    }
  }

  // --- HSE: Hazard + RiskAssessment + PermitToWork + StopWorkOrder --------
  for (const project of projects) {
    let hazard = await db.hazard.findFirst({ where: { tenantId, projectId: project.id } });
    if (!hazard) {
      hazard = await db.hazard.create({
        data: {
          tenantId,
          projectId: project.id,
          title: "Unguarded floor opening",
          description: "Floor opening on level 2 near the stairwell has no barrier or cover.",
          category: "HEIGHT",
          likelihood: "LIKELY",
          severity: "MAJOR",
          controlLevel: "ENGINEERING",
          controlNotes: "Physical barrier installed pending permanent guardrail.",
          status: "CONTROLLED",
          identifiedById: owner.id,
        },
      });
      await db.hseActivity.create({
        data: { tenantId, entityType: "Hazard", entityId: hazard.id, actorId: owner.id, eventType: "LOGGED", summary: `Hazard logged: ${hazard.title}` },
      });
      console.log(`Hazard seeded for project ${project.name}`);
    }

    const existingRa = await db.riskAssessment.findFirst({ where: { tenantId, projectId: project.id } });
    if (!existingRa) {
      const ra = await db.riskAssessment.create({
        data: {
          tenantId,
          projectId: project.id,
          hazardId: hazard.id,
          title: `${project.name} — General Site Risk Assessment`,
          status: "APPROVED",
          validFrom: new Date(),
          approvedById: owner.id,
          createdById: owner.id,
        },
      });
      await db.hseActivity.create({
        data: { tenantId, entityType: "RiskAssessment", entityId: ra.id, actorId: owner.id, eventType: "APPROVED", summary: "Risk assessment approved" },
      });
      console.log(`Risk assessment seeded for project ${project.name}`);
    }

    const existingPermit = await db.permitToWork.findFirst({ where: { tenantId, projectId: project.id } });
    if (!existingPermit) {
      const permit = await db.permitToWork.create({
        data: {
          tenantId,
          projectId: project.id,
          permitType: "WORKING_AT_HEIGHT",
          status: "ACTIVE",
          description: "Guardrail installation at level 2 stairwell.",
          validFrom: new Date(),
          requestedById: owner.id,
          issuedById: owner.id,
        },
      });
      await db.hseActivity.create({
        data: { tenantId, entityType: "PermitToWork", entityId: permit.id, actorId: owner.id, eventType: "REQUESTED", summary: `Permit to work requested: ${permit.permitType}` },
      });
      console.log(`Permit to work seeded for project ${project.name}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
