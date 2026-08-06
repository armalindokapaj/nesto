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

// ---------------------------------------------------------------------------
// Phase 2 — Personal control: quiet hours + digest schedule. Both are pure
// preference records read by future dispatch logic; there's no background
// scheduler in this stack, so "digest" here means an on-demand summary
// (getDigestPreview below), not a cron-generated DigestInstance.
// ---------------------------------------------------------------------------

export async function getQuietHours(tenantId: string, userId: string) {
  return db.notificationQuietHours.findUnique({ where: { userId } });
}

export async function setQuietHours(tenantId: string, userId: string, input: { timezone: string; startTime: string; endTime: string; enabled: boolean }) {
  return db.notificationQuietHours.upsert({
    where: { userId },
    create: { tenantId, userId, ...input },
    update: input,
  });
}

/** Local wall-clock check against IANA timezone quiet hours (handles overnight ranges like 22:00-07:00). */
export function isWithinQuietHours(quietHours: { timezone: string; startTime: string; endTime: string; enabled: boolean } | null, now = new Date()): boolean {
  if (!quietHours?.enabled) return false;
  const local = new Intl.DateTimeFormat("en-GB", { timeZone: quietHours.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const [h, m] = local.split(":").map(Number);
  const minutes = h * 60 + m;
  const [sh, sm] = quietHours.startTime.split(":").map(Number);
  const [eh, em] = quietHours.endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export async function getDigestRule(tenantId: string, userId: string) {
  return db.digestRule.findUnique({ where: { userId } });
}

export async function setDigestRule(tenantId: string, userId: string, input: { frequency: string; timeOfDay: string }) {
  return db.digestRule.upsert({ where: { userId }, create: { tenantId, userId, ...input }, update: input });
}

/** On-demand digest — unread notifications since the window start, re-checking nothing extra (Notification rows are already permission-filtered at creation). */
export async function getDigestPreview(tenantId: string, userId: string, sinceDays = 1) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return db.notification.findMany({ where: { tenantId, userId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 50 });
}

// ---------------------------------------------------------------------------
// Phase 3 — Enterprise comms: announcements (optionally mandatory-ack) and
// emergency alerts (capability-gated activation, bypass quiet hours by
// definition since they're delivered as regular in-app notifications
// regardless of the recipient's quiet-hours preference).
// ---------------------------------------------------------------------------

export async function listAnnouncements(tenantId: string) {
  return db.announcement.findMany({
    where: { tenantId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { acks: true },
    orderBy: { publishedAt: "desc" },
  });
}

export async function createAnnouncement(
  tenantId: string,
  actorId: string,
  input: { title: string; body: string; audienceType: string; audienceValue?: string; mandatoryAck: boolean; expiresAt?: Date }
) {
  const announcement = await db.announcement.create({ data: { tenantId, publishedById: actorId, ...input } });
  // Deliver as a regular in-app notification to every tenant member — the
  // one place this app does do a broadcast, and only because Announcement is
  // itself the explicit, admin-authored broadcast primitive (distinct from
  // publishEvent's per-recipient-resolved delivery).
  const members = await db.companyMembership.findMany({ where: { tenantId, accessMode: { not: "SUSPENDED" } }, select: { userId: true } });
  await db.notification.createMany({
    data: members.map((m) => ({ tenantId, userId: m.userId, type: "ANNOUNCEMENT", title: input.title, body: input.body, link: "/announcements" })),
  });
  return announcement;
}

export async function acknowledgeAnnouncement(tenantId: string, announcementId: string, userId: string) {
  const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
  if (!announcement || announcement.tenantId !== tenantId) throw new Error("Announcement not found.");
  return db.announcementAck.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    create: { announcementId, userId },
    update: {},
  });
}

export async function listEmergencyAlerts(tenantId: string) {
  return db.emergencyAlert.findMany({ where: { tenantId }, orderBy: { activatedAt: "desc" } });
}

export async function activateEmergencyAlert(tenantId: string, actorId: string, input: { title: string; body: string }) {
  const alert = await db.emergencyAlert.create({ data: { tenantId, activatedById: actorId, ...input } });
  const members = await db.companyMembership.findMany({ where: { tenantId, accessMode: { not: "SUSPENDED" } }, select: { userId: true } });
  await db.notification.createMany({
    data: members.map((m) => ({ tenantId, userId: m.userId, type: "EMERGENCY_ALERT", title: `🚨 ${input.title}`, body: input.body, link: "/notifications" })),
  });
  await db.auditEvent.create({ data: { tenantId, actorId, action: "EMERGENCY_ALERT_ACTIVATED", targetType: "EmergencyAlert", targetId: alert.id } });
  return alert;
}

export async function resolveEmergencyAlert(tenantId: string, actorId: string, alertId: string) {
  const alert = await db.emergencyAlert.findUnique({ where: { id: alertId } });
  if (!alert || alert.tenantId !== tenantId) throw new Error("Alert not found.");
  return db.emergencyAlert.update({ where: { id: alertId }, data: { resolvedById: actorId, resolvedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Phase 4 — External channels. This app has no real SMTP/push/SMS provider
// credentials configured anywhere, so a "send" here composes the redacted
// preview and records it as SIMULATED rather than making a live external
// call — same "registry + logged intent, no fabricated external call"
// boundary already used for IT Admin (no live SSO) and BIM (no live viewer).
// A future integration only has to replace the body of this one function.
// ---------------------------------------------------------------------------

export async function simulateExternalDelivery(
  tenantId: string,
  input: { recipientUserId: string; channel: "EMAIL" | "PUSH" | "SMS"; subject?: string; sensitiveBody: string }
) {
  // The minimized/safe version only — never the raw sensitive body, per the
  // PRD's external-channel redaction rule.
  const redactedPreview = input.subject ? `${input.subject} — see in-app for details.` : "You have a new notification — see in-app for details.";
  return db.notificationDeliveryLog.create({
    data: { tenantId, recipientUserId: input.recipientUserId, channel: input.channel, status: "SIMULATED", subject: input.subject, redactedPreview },
  });
}

export async function listDeliveryLog(tenantId: string, take = 50) {
  return db.notificationDeliveryLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take });
}
