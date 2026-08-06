import { db } from "@/lib/db";

// PRD_Notifications_Event_Centre — Phase 1 "Core event + inbox" only. See
// the schema comment above EventCatalogueEntry/NotificationPolicy for the
// scope decision (governed infra for new call sites, not a retrofit of the
// existing ad-hoc `db.notification.create` sites).

const EVENT_CATALOGUE: { key: string; label: string; description: string; module: string; sensitivity: string }[] = [
  { key: "WORK_PROGRESS.PROGRESS_SUBMITTED_FOR_VERIFICATION", label: "Progress claim submitted", description: "A progress claim was submitted and needs verification.", module: "Work Progress", sensitivity: "STANDARD" },
  { key: "WORK_PROGRESS.BASELINE_ACTIVATED", label: "Baseline activated", description: "A schedule version was promoted to the active project baseline.", module: "Work Progress", sensitivity: "STANDARD" },
  { key: "PROCUREMENT.SUPPLIER_DOCUMENT_EXPIRING", label: "Supplier document expiring", description: "A supplier's compliance document is expiring soon or has expired.", module: "Procurement", sensitivity: "INTERNAL" },
  { key: "PROCUREMENT.PURCHASE_ORDER_ISSUED", label: "Purchase order issued", description: "A purchase order was issued to a supplier.", module: "Procurement", sensitivity: "STANDARD" },
  { key: "HSE.INCIDENT_REPORTED", label: "Incident reported", description: "A new HSE incident was reported.", module: "HSE", sensitivity: "RESTRICTED" },
  { key: "HSE.STOP_WORK_ISSUED", label: "Stop-work order issued", description: "Work was stopped on a project, zone or activity.", module: "HSE", sensitivity: "EMERGENCY" },
  { key: "DOCUMENTS.REQUIRED_READING_ASSIGNED", label: "Required reading assigned", description: "A document was assigned to you as required reading.", module: "Documents", sensitivity: "STANDARD" },
  { key: "DOCUMENTS.DEPENDENCY_IMPACTED", label: "Dependent document may need review", description: "A document you depend on received a new revision.", module: "Documents", sensitivity: "STANDARD" },
  { key: "ANALYTICS.REPORT_EXECUTED", label: "Saved report executed", description: "A saved report you created was run.", module: "Analytics", sensitivity: "INTERNAL" },
];

/** Idempotent seed — safe to call on every Event Centre admin page load. */
export async function ensureEventCatalogue(tenantId: string) {
  await Promise.all(
    EVENT_CATALOGUE.map((e) =>
      db.eventCatalogueEntry.upsert({
        where: { tenantId_key: { tenantId, key: e.key } },
        create: { tenantId, ...e },
        update: { label: e.label, description: e.description, module: e.module, sensitivity: e.sensitivity },
      })
    )
  );
  return db.eventCatalogueEntry.findMany({ where: { tenantId }, include: { policy: true }, orderBy: [{ module: "asc" }, { label: "asc" }] });
}

export async function setNotificationPolicy(tenantId: string, actorId: string, eventKey: string, input: { mandatory: boolean; inAppEnabled: boolean }) {
  await db.eventCatalogueEntry.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key: eventKey } } });
  return db.notificationPolicy.upsert({
    where: { tenantId_eventKey: { tenantId, eventKey } },
    create: { tenantId, eventKey, updatedById: actorId, ...input },
    update: { updatedById: actorId, ...input },
  });
}

/**
 * Governed publish — checks the event's policy (falling back to "in-app,
 * optional" if no override was ever set), then creates one Notification
 * per already permission-filtered recipient. `recipientIds` MUST already be
 * the result of a permission-safe resolution by the caller (PRD §9 "no
 * automatic department/team/company broadcasting") — this function does not
 * itself expand roles into users.
 *
 * Dedup is a simple proxy for the PRD's full versioned dedup key: skip a
 * recipient who already has an unread notification for this exact event key
 * + link within the last 24h, so a retried publish (or a duplicate trigger)
 * never doubles someone's inbox.
 */
export async function publishEvent(
  tenantId: string,
  eventKey: string,
  input: { recipientIds: string[]; title: string; body?: string; link?: string; actorId?: string }
) {
  const policy = await db.notificationPolicy.findUnique({ where: { tenantId_eventKey: { tenantId, eventKey } } });
  const inAppEnabled = policy?.inAppEnabled ?? true;
  if (!inAppEnabled) return { published: 0, skipped: input.recipientIds.length };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.notification.findMany({
    where: { tenantId, userId: { in: input.recipientIds }, type: eventKey, link: input.link, isRead: false, createdAt: { gte: since } },
    select: { userId: true },
  });
  const alreadyNotified = new Set(existing.map((n) => n.userId));
  const targets = input.recipientIds.filter((id) => !alreadyNotified.has(id));
  if (!targets.length) return { published: 0, skipped: input.recipientIds.length };

  await db.notification.createMany({
    data: targets.map((userId) => ({ tenantId, userId, type: eventKey, title: input.title, body: input.body, link: input.link })),
  });
  await db.auditEvent.create({
    data: { tenantId, actorId: input.actorId, action: "EVENT_PUBLISHED", targetType: "EventCatalogueEntry", targetId: eventKey, metadata: JSON.stringify({ recipientCount: targets.length }) },
  });
  return { published: targets.length, skipped: input.recipientIds.length - targets.length };
}

export async function getNotificationVolume(tenantId: string, days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.notification.groupBy({ by: ["type"], where: { tenantId, createdAt: { gte: since } }, _count: { _all: true } });
  return rows.map((r) => ({ type: r.type, count: r._count._all })).sort((a, b) => b.count - a.count);
}
