import type { FixtureContext } from "./context";
import { ensureEventCatalogue, setNotificationPolicy, publishEvent, setQuietHours, setDigestRule, createAnnouncement, activateEmergencyAlert, resolveEmergencyAlert, simulateExternalDelivery } from "@/server/event-centre";
import { ensureMetricCatalogue, createReportDefinition, executeReport, issueReportExecution, setCurrencyRate } from "@/server/analytics";
import { registerBimModel, addBimModelVersion, createBimObjectLink } from "@/server/bim";

export async function seedNotificationsReportingBim(ctx: FixtureContext) {
  const { db, tenantId, owner, users, projects } = ctx;
  console.log("Notifications Event Centre, Reporting/Analytics, BIM…");

  // --- Notifications Event Centre --------------------------------------------
  await ensureEventCatalogue(tenantId); // idempotent, safe every run
  if (!(await db.notificationPolicy.findFirst({ where: { tenantId } }))) {
    await setNotificationPolicy(tenantId, owner.id, "HSE.STOP_WORK_ISSUED", { mandatory: true, inAppEnabled: true });
    await setNotificationPolicy(tenantId, owner.id, "ANALYTICS.REPORT_EXECUTED", { mandatory: false, inAppEnabled: true });
    console.log("  + Notification policies set");
  }
  if (!(await db.notification.findFirst({ where: { tenantId, type: "DOCUMENTS.REQUIRED_READING_ASSIGNED" } }))) {
    await publishEvent(tenantId, "DOCUMENTS.REQUIRED_READING_ASSIGNED", {
      recipientIds: [users.besnik.id, users.gentian.id],
      title: "Required reading assigned",
      body: "Riverside Towers — Monthly Progress Report (July) was assigned to you as required reading.",
      link: "/documents",
      actorId: owner.id,
    });
    console.log("  + Governed event published: DOCUMENTS.REQUIRED_READING_ASSIGNED");
  }

  if (!(await db.notificationQuietHours.findFirst({ where: { tenantId } }))) {
    await setQuietHours(tenantId, users.elira.id, { timezone: "Europe/Tirane", startTime: "21:00", endTime: "07:30", enabled: true });
    await setDigestRule(tenantId, users.elira.id, { frequency: "DAILY", timeOfDay: "08:00" });
    console.log("  + Quiet hours + daily digest rule for Elira");
  }

  if (!(await db.announcement.findFirst({ where: { tenantId } }))) {
    await createAnnouncement(tenantId, owner.id, {
      title: "New Safety Induction Requirement",
      body: "All site personnel must complete the updated induction before entering any active floor from next Monday.",
      audienceType: "ALL",
      mandatoryAck: true,
    });
    console.log("  + Announcement (mandatory ack): New Safety Induction Requirement");

    const alert = await activateEmergencyAlert(tenantId, owner.id, { title: "Site Evacuation Drill — Riverside Towers", body: "Scheduled evacuation drill at 14:00 today. This is a planned exercise." });
    await resolveEmergencyAlert(tenantId, owner.id, alert.id);
    console.log("  + EmergencyAlert (activated and resolved) — drill example");

    await simulateExternalDelivery(tenantId, { recipientUserId: users.ana.id, channel: "EMAIL", subject: "New Safety Induction Requirement", sensitiveBody: "Full announcement body would go here." });
    console.log("  + Simulated external delivery log entry (no real email sent)");
  }

  // --- Reporting & Analytics ------------------------------------------------
  await ensureMetricCatalogue(tenantId); // idempotent
  if (!(await db.reportDefinition.findFirst({ where: { tenantId } }))) {
    const projectsReport = await createReportDefinition(tenantId, owner.id, { companyId: ctx.companyId, name: "Monthly Projects Status", kind: "PROJECTS_STATUS" });
    const financeReport = await createReportDefinition(tenantId, owner.id, { companyId: ctx.companyId, name: "Budget vs Actual — All Projects", kind: "FINANCE_BUDGET_VS_ACTUAL" });
    console.log("  + ReportDefinitions: Monthly Projects Status, Budget vs Actual");

    const execution = await executeReport(tenantId, owner.id, projectsReport.id, { finance: true, hr: true, procurement: true, workProgress: true, hse: true });
    await issueReportExecution(tenantId, owner.id, execution.executionId);
    console.log("  + Issued/frozen snapshot of the Projects Status report");

    await executeReport(tenantId, owner.id, financeReport.id, { finance: true, hr: true, procurement: true, workProgress: true, hse: true });
    console.log("  + Live execution of the Finance report (not issued — stays live)");
  }

  if (!(await db.currencyRate.findFirst({ where: { tenantId } }))) {
    await setCurrencyRate(tenantId, owner.id, { fromCurrency: "EUR", toCurrency: "ALL", rate: 103.5 });
    await setCurrencyRate(tenantId, owner.id, { fromCurrency: "ALL", toCurrency: "EUR", rate: 0.00966 });
    console.log("  + Currency rates EUR<->ALL");
  }

  // --- BIM registry -----------------------------------------------------------
  if (!(await db.bimModel.findFirst({ where: { tenantId } }))) {
    const model = await registerBimModel(tenantId, owner.id, { projectId: projects.riverside.id, name: "Riverside Towers — Architectural Model", discipline: "ARCHITECTURAL", description: "Federated architectural model, Tower A + B." });
    await addBimModelVersion(tenantId, owner.id, { modelId: model.id, fileName: "riverside-towers-arch-v1.ifc", notes: "Initial coordination model — no glTF export yet, so no live preview is expected here." });
    await createBimObjectLink(tenantId, owner.id, { modelId: model.id, objectRef: "Tower-A-Level-12", entityType: "TASK", entityId: (await db.task.findFirst({ where: { tenantId } }))?.id ?? "", relation: "relates_to" });
    console.log("  + BimModel registered (IFC source — demonstrates the honest 'no live preview' fallback since no glTF/GLB is uploaded)");
  }
}
