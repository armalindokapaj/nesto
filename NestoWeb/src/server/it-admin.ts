import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { allocateNumber } from "@/server/number-series";

// PRD_IT_Administration_Integrations_Service_Management — Phase 1 "IT
// Foundation" only. See the schema comment above ItDepartmentProfile for the
// full scope decision (no external SSO/M365/Google/webhook adapters here).

/** System-provisioned per company, per the PRD — idempotent, safe to call on every dashboard load. */
export async function ensureItDepartment(tenantId: string) {
  return db.itDepartmentProfile.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

export async function getItDashboard(tenantId: string) {
  await ensureItDepartment(tenantId);
  const [deviceCount, licenceCount, openTickets, ticketsByType] = await Promise.all([
    db.itDevice.count({ where: { tenantId, status: "ACTIVE" } }),
    db.softwareLicence.count({ where: { tenantId } }),
    db.itServiceTicket.count({ where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.itServiceTicket.groupBy({ by: ["ticketType"], where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS"] } }, _count: true }),
  ]);
  return { deviceCount, licenceCount, openTickets, ticketsByType };
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export async function listItDevices(tenantId: string) {
  return db.itDevice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}

export async function createItDevice(tenantId: string, actorId: string, input: { name: string; deviceType: string; ownerUserId?: string; serialNumber?: string; notes?: string }) {
  return db.itDevice.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function setItDeviceStatus(tenantId: string, deviceId: string, status: string) {
  const device = assertTenant(await db.itDevice.findUnique({ where: { id: deviceId } }), tenantId, "ItDevice");
  return db.itDevice.update({ where: { id: device.id }, data: { status } });
}

// ---------------------------------------------------------------------------
// Software Licences
// ---------------------------------------------------------------------------

export async function listSoftwareLicences(tenantId: string) {
  const licences = await db.softwareLicence.findMany({
    where: { tenantId },
    include: { assignments: { where: { revokedAt: null } } },
    orderBy: { createdAt: "desc" },
  });
  return licences.map((l) => ({ ...l, seatsUsed: l.assignments.length }));
}

export async function createSoftwareLicence(tenantId: string, actorId: string, input: { productName: string; vendor?: string; seatsTotal: number; expiresAt?: Date; costPerSeat?: number; notes?: string }) {
  return db.softwareLicence.create({ data: { tenantId, createdById: actorId, ...input } });
}

export async function assignLicenceSeat(tenantId: string, licenceId: string, userId: string) {
  const licence = assertTenant(await db.softwareLicence.findUnique({ where: { id: licenceId }, include: { assignments: { where: { revokedAt: null } } } }), tenantId, "SoftwareLicence");
  if (licence.assignments.length >= licence.seatsTotal) throw new Error("No free seats left on this licence.");
  return db.licenceAssignment.create({ data: { licenceId: licence.id, userId } });
}

export async function revokeLicenceSeat(tenantId: string, assignmentId: string) {
  const assignment = await db.licenceAssignment.findUnique({ where: { id: assignmentId }, include: { licence: true } });
  if (!assignment) throw new Error("Assignment not found.");
  assertTenant(assignment.licence, tenantId, "SoftwareLicence");
  return db.licenceAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Service Desk
// ---------------------------------------------------------------------------

export async function listItTickets(tenantId: string) {
  return db.itServiceTicket.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}

export async function getItTicket(tenantId: string, ticketId: string) {
  const ticket = assertTenant(
    await db.itServiceTicket.findUnique({ where: { id: ticketId }, include: { comments: { orderBy: { createdAt: "asc" } } } }),
    tenantId,
    "ItServiceTicket"
  );
  return ticket;
}

export async function createItTicket(
  tenantId: string,
  requestedById: string,
  input: { ticketType: string; title: string; description?: string; priority?: string }
) {
  const number = await allocateNumber(tenantId, "IT_TICKET");
  return db.itServiceTicket.create({ data: { tenantId, number, requestedById, ...input } });
}

const TICKET_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

export async function setItTicketStatus(tenantId: string, ticketId: string, status: string, assignedToId?: string) {
  const ticket = assertTenant(await db.itServiceTicket.findUnique({ where: { id: ticketId } }), tenantId, "ItServiceTicket");
  if (!TICKET_TRANSITIONS[ticket.status]?.includes(status)) {
    throw new Error(`Cannot move a ${ticket.status} ticket to ${status}.`);
  }
  return db.itServiceTicket.update({
    where: { id: ticket.id },
    data: {
      status,
      assignedToId: assignedToId ?? ticket.assignedToId,
      resolvedAt: status === "RESOLVED" ? new Date() : ticket.resolvedAt,
      closedAt: status === "CLOSED" ? new Date() : ticket.closedAt,
    },
  });
}

export async function addItTicketComment(tenantId: string, ticketId: string, authorId: string, body: string) {
  const ticket = assertTenant(await db.itServiceTicket.findUnique({ where: { id: ticketId } }), tenantId, "ItServiceTicket");
  return db.itTicketComment.create({ data: { ticketId: ticket.id, authorId, body } });
}
