import type { FixtureContext } from "./context";
import { createWorkflowDefinition, startWorkflow, decide } from "@/server/workflow-engine";
import { grantCapability } from "@/server/capabilities";
import { createItDevice, createSoftwareLicence, assignLicenceSeat, createItTicket, addItTicketComment, setItTicketStatus } from "@/server/it-admin";
import { registerDevice } from "@/server/mobile-access";
import { createExternalOrganization, addPortalMember, grantProjectAccess } from "@/server/portal-access";

export async function seedPlatformAdmin(ctx: FixtureContext) {
  const { db, tenantId, owner, users, projects, roleAccount } = ctx;
  console.log("Platform admin (Workflow Engine, Capability Grants, IT Admin, Mobile/Portal Access)…");

  // --- Workflow Engine -------------------------------------------------------
  if (!(await db.workflowDefinition.findFirst({ where: { tenantId } }))) {
    const invoice = await db.invoice.findFirst({ where: { tenantId, type: "INVOICE" } });
    const definition = await createWorkflowDefinition(tenantId, owner.id, {
      key: "SAMPLE_EXPENSE_APPROVAL",
      name: "Expense Approval — Manager then Finance",
      sourceModule: "Finance",
      sourceEntityType: "Invoice",
      stages: [
        { name: "Manager Review", approverRole: "PM" },
        { name: "Finance Sign-off", approverRole: "FINANCE" },
      ],
    });
    console.log("  + WorkflowDefinition: SAMPLE_EXPENSE_APPROVAL");

    if (invoice) {
      // Fully decided instance — both stages approved, sitting at
      // SOURCE_FINALIZATION_PENDING (WF-FR-015: approved is distinct from
      // the owning module having applied its own transition).
      const [pmAccount, financeAccount] = await Promise.all([roleAccount("Pm"), roleAccount("Finance")]);
      const instance1 = await startWorkflow(tenantId, owner.id, { workflowDefinitionKey: definition.key, sourceEntityId: invoice.id });
      const stage1 = instance1.stages.find((s) => s.sequence === 1)!;
      await decide(tenantId, pmAccount.id, "PM", stage1.id, "APPROVE", "Reviewed, looks correct.");
      const instance1After = await db.workflowInstance.findUniqueOrThrow({ where: { id: instance1.id }, include: { stages: true } });
      const stage2 = instance1After.stages.find((s) => s.sequence === 2)!;
      await decide(tenantId, financeAccount.id, "FINANCE", stage2.id, "APPROVE", "Signed off.");
      console.log("  + WorkflowInstance #1: fully approved (source finalization pending)");

      // A second instance still sitting in the Pm test account's queue, so
      // /workflows (My Approvals) has something to act on.
      const secondInvoice = await db.invoice.findFirst({ where: { tenantId, type: "INVOICE", id: { not: invoice.id } } });
      if (secondInvoice) {
        await startWorkflow(tenantId, owner.id, { workflowDefinitionKey: definition.key, sourceEntityId: secondInvoice.id });
        console.log("  + WorkflowInstance #2: pending Manager Review (visible in the 'Pm' account's My Approvals)");
      }
    }
  }

  // --- Capability Grants -------------------------------------------------
  if (!(await db.userCapabilityGrant.findFirst({ where: { tenantId } }))) {
    await grantCapability(tenantId, owner.id, users.besnik.id, "hr.compensation.view");
    await grantCapability(tenantId, owner.id, users.gentian.id, "notifications.emergency_alert.activate");
    console.log("  + Capability grants: hr.compensation.view -> Besnik, emergency_alert.activate -> Gentian");
  }

  // --- IT Administration -----------------------------------------------------
  if (!(await db.itDevice.findFirst({ where: { tenantId } }))) {
    await createItDevice(tenantId, owner.id, { name: "Elira Doda — MacBook Pro", deviceType: "LAPTOP", ownerUserId: users.elira.id, serialNumber: "C02SEED001" });
    await createItDevice(tenantId, owner.id, { name: "Site Office — Desktop 1", deviceType: "DESKTOP", serialNumber: "C02SEED002" });
    await createItDevice(tenantId, owner.id, { name: "Gentian Hoxha — iPhone 15", deviceType: "MOBILE", ownerUserId: users.gentian.id, serialNumber: "IMEISEED003" });
    console.log("  + IT devices");

    const licence = await createSoftwareLicence(tenantId, owner.id, { productName: "AutoCAD", vendor: "Autodesk", seatsTotal: 5, costPerSeat: 45 });
    await assignLicenceSeat(tenantId, licence.id, users.elira.id);
    await assignLicenceSeat(tenantId, licence.id, users.sara.id);
    await createSoftwareLicence(tenantId, owner.id, { productName: "Microsoft 365 Business", vendor: "Microsoft", seatsTotal: 20, costPerSeat: 12 });
    console.log("  + Software licences + seat assignments");

    const ticket = await createItTicket(tenantId, users.besnik.id, { ticketType: "INCIDENT", title: "Site laptop won't connect to VPN", priority: "HIGH", description: "VPN client fails to authenticate from the site office network." });
    await setItTicketStatus(tenantId, ticket.id, "IN_PROGRESS", owner.id);
    await addItTicketComment(tenantId, ticket.id, owner.id, "Reset VPN certificate remotely — asking Besnik to retry.");
    await createItTicket(tenantId, users.ana.id, { ticketType: "REQUEST", title: "New laptop for incoming HR hire", priority: "MEDIUM" });
    console.log("  + IT service tickets");
  }

  // --- Mobile Access -----------------------------------------------------
  if (!(await db.registeredDevice.findFirst({ where: { tenantId } }))) {
    await registerDevice(tenantId, users.gentian.id, { platform: "IOS", deviceLabel: "Gentian's iPhone" });
    await registerDevice(tenantId, users.besnik.id, { platform: "ANDROID", deviceLabel: "Besnik's Site Tablet" });
    await registerDevice(tenantId, owner.id, { platform: "WEB", deviceLabel: "Arben's Browser" });
    console.log("  + Registered mobile/web devices");
  }

  // --- Client/Supplier Portal Access -----------------------------------------
  if (!(await db.externalOrganization.findFirst({ where: { tenantId } }))) {
    const riversideClient = await db.client.findFirst({ where: { tenantId, name: "Riverside Holdings" } });
    const org = await createExternalOrganization(tenantId, owner.id, {
      name: "Riverside Holdings",
      orgType: "CLIENT",
      linkedClientId: riversideClient?.id,
    });
    try {
      const clientAccount = await roleAccount("Client");
      await addPortalMember(tenantId, owner.id, org.id, clientAccount.id, "ADMIN");
      await grantProjectAccess(tenantId, owner.id, org.id, projects.riverside.id);
      console.log("  + ExternalOrganization: Riverside Holdings, 'Client' test account added + granted Riverside Towers access");
    } catch {
      console.log("  + ExternalOrganization: Riverside Holdings (no 'Client' test account found to add as member)");
    }

    const supplierOrg = await createExternalOrganization(tenantId, owner.id, { name: "SteelWorks Albania", orgType: "SUPPLIER" });
    console.log(`  + ExternalOrganization: ${supplierOrg.name} (supplier)`);
  }
}
