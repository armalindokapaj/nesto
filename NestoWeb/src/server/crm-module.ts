import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/crm-constants";

// PRD_CRM_Module — additive layer on top of the existing thin Client model
// and src/server/clients.ts (which stays untouched and keeps serving the
// existing Client Profile's tasks/documents/comments sections). §46 Data
// Ownership Rules: CRM owns clients, contacts, leads, opportunities,
// pipelines and notes; units/contracts/finance/documents/tasks stay
// source-linked, never duplicated here.

export {
  CLIENT_TYPE_SUGGESTIONS,
  CONTACT_ROLE_SUGGESTIONS,
  LEAD_SOURCE_SUGGESTIONS,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  CLIENT_UNIT_RELATIONSHIP_TYPES,
  DEPOSIT_STATUSES,
  RESERVATION_STATUSES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
  SUPPORT_CASE_PRIORITIES,
  SUPPORT_CASE_STATUSES,
} from "@/lib/crm-constants";

// ---------------------------------------------------------------------------
// Recent Activity (PRD_Sales_Dashboard §17) — per-module activity table,
// same pattern as UnitActivityEvent/ContractActivity. Every CRM mutation
// below that represents a client-facing event logs one row here.
// ---------------------------------------------------------------------------

async function logCrmActivity(
  tenantId: string,
  input: { clientId: string; actorId: string; eventType: string; summary: string; entityType?: string; entityId?: string }
) {
  await db.crmActivityEvent.create({ data: { tenantId, ...input } });
}

export async function getCrmActivityFeed(tenantId: string, limit = 20) {
  return db.crmActivityEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { client: { select: { id: true, name: true } }, actor: { select: { id: true, displayName: true, avatarColor: true } } },
  });
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** §22 — idempotent seed of the PRD's default pipeline. Safe to re-run. */
export async function ensureDefaultPipeline(tenantId: string) {
  const existing = await db.pipeline.findFirst({ where: { tenantId, isDefault: true } });
  if (existing) return existing;

  return db.pipeline.create({
    data: {
      tenantId,
      name: "Default Sales Pipeline",
      isDefault: true,
      stages: {
        create: DEFAULT_PIPELINE_STAGES.map((s, i) => ({ tenantId, name: s.name, orderNo: i, probability: s.probability })),
      },
    },
  });
}

export async function getPipelineBoard(tenantId: string) {
  const pipeline = await ensureDefaultPipeline(tenantId);
  const stages = await db.pipelineStage.findMany({
    where: { tenantId, pipelineId: pipeline.id },
    orderBy: { orderNo: "asc" },
    include: {
      opportunities: {
        where: { status: "OPEN" },
        orderBy: { stageEnteredAt: "desc" },
        include: { client: { select: { id: true, name: true } }, owner: { select: { id: true, displayName: true } } },
      },
    },
  });
  return { pipeline, stages };
}

export async function moveOpportunityStage(tenantId: string, input: { opportunityId: string; stageId: string; actorId: string }) {
  const opp = assertTenant(await db.opportunity.findUnique({ where: { id: input.opportunityId } }), tenantId, "Opportunity");
  const stage = assertTenant(await db.pipelineStage.findUnique({ where: { id: input.stageId } }), tenantId, "PipelineStage");
  if (stage.pipelineId !== opp.pipelineId) throw new Error("Stage belongs to a different pipeline.");
  const updated = await db.opportunity.update({
    where: { id: input.opportunityId },
    data: { stageId: input.stageId, stageEnteredAt: new Date() },
  });
  await logCrmActivity(tenantId, {
    clientId: opp.clientId,
    actorId: input.actorId,
    eventType: "OPPORTUNITY_STAGE_CHANGED",
    summary: `Opportunity moved to ${stage.name}`,
    entityType: "OPPORTUNITY",
    entityId: opp.id,
  });
  return updated;
}

export async function closeOpportunity(
  tenantId: string,
  input: { opportunityId: string; status: "WON" | "LOST"; lostReason?: string; actorId: string }
) {
  const opp = assertTenant(await db.opportunity.findUnique({ where: { id: input.opportunityId } }), tenantId, "Opportunity");
  const updated = await db.opportunity.update({
    where: { id: input.opportunityId },
    data: { status: input.status, lostReason: input.status === "LOST" ? input.lostReason : null },
  });
  await logCrmActivity(tenantId, {
    clientId: opp.clientId,
    actorId: input.actorId,
    eventType: input.status === "WON" ? "OPPORTUNITY_WON" : "OPPORTUNITY_LOST",
    summary: input.status === "WON" ? "Opportunity won" : "Opportunity lost",
    entityType: "OPPORTUNITY",
    entityId: opp.id,
  });
  return updated;
}

export async function createOpportunity(
  tenantId: string,
  input: { clientId: string; title: string; contactId?: string | null; estimatedValue?: number | null; ownerId?: string | null; actorId: string }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const pipeline = await ensureDefaultPipeline(tenantId);
  const firstStage = await db.pipelineStage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.id }, orderBy: { orderNo: "asc" } });

  const opportunity = await db.opportunity.create({
    data: {
      tenantId,
      clientId: input.clientId,
      contactId: input.contactId ?? null,
      title: input.title.trim(),
      estimatedValue: input.estimatedValue ?? null,
      ownerId: input.ownerId ?? null,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
    },
  });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId: input.actorId,
    eventType: "OPPORTUNITY_CREATED",
    summary: `Opportunity created: ${opportunity.title}`,
    entityType: "OPPORTUNITY",
    entityId: opportunity.id,
  });
  return opportunity;
}

export async function listOpportunities(tenantId: string) {
  return db.opportunity.findMany({
    where: { tenantId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      stage: true,
      owner: { select: { id: true, displayName: true, avatarColor: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Clients — extends the existing thin Client with the CRM fields/relations.
// ---------------------------------------------------------------------------

export async function getClientCrmDetail(tenantId: string, clientId: string, userId: string) {
  const client = assertTenant(
    await db.client.findUnique({
      where: { id: clientId },
      include: {
        owner: { select: { id: true, displayName: true, avatarColor: true } },
        contacts: { orderBy: { createdAt: "asc" }, include: { relationshipOwner: { select: { id: true, displayName: true } } } },
        notes: {
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          include: { author: { select: { id: true, displayName: true, avatarColor: true } } },
        },
        opportunities: {
          orderBy: { createdAt: "desc" },
          include: { stage: true, owner: { select: { id: true, displayName: true } } },
        },
        leads: { orderBy: { createdAt: "desc" } },
        stars: { where: { userId }, select: { id: true } },
      },
    }),
    tenantId,
    "Client"
  );
  return { ...client, isStarred: client.stars.length > 0 };
}

export async function updateClientCrmFields(
  tenantId: string,
  input: {
    clientId: string;
    clientType?: string | null;
    ownerId?: string | null;
    source?: string | null;
    country?: string | null;
    preferredContactMethod?: string | null;
  }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const { clientId, ...data } = input;
  return db.client.update({ where: { id: clientId }, data });
}

export async function toggleClientStar(tenantId: string, clientId: string, userId: string) {
  assertTenant(await db.client.findUnique({ where: { id: clientId } }), tenantId, "Client");
  const existing = await db.clientStar.findUnique({ where: { clientId_userId: { clientId, userId } } });
  if (existing) {
    await db.clientStar.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await db.clientStar.create({ data: { tenantId, clientId, userId } });
  return { starred: true };
}

export async function archiveClient(tenantId: string, clientId: string) {
  assertTenant(await db.client.findUnique({ where: { id: clientId } }), tenantId, "Client");
  return db.client.update({ where: { id: clientId }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
}

export async function restoreClient(tenantId: string, clientId: string) {
  assertTenant(await db.client.findUnique({ where: { id: clientId } }), tenantId, "Client");
  return db.client.update({ where: { id: clientId }, data: { archivedAt: null, status: "ACTIVE" } });
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function addContact(
  tenantId: string,
  input: { clientId: string; name: string; title?: string; department?: string; email?: string; phone?: string; role?: string; actorId: string }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const { actorId, ...data } = input;
  const contact = await db.contact.create({ data: { tenantId, ...data, name: data.name.trim() } });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId,
    eventType: "CONTACT_ADDED",
    summary: `Contact added: ${contact.name}`,
    entityType: "CONTACT",
    entityId: contact.id,
  });
  return contact;
}

export async function listContacts(tenantId: string) {
  return db.contact.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, name: true } }, relationshipOwner: { select: { id: true, displayName: true } } },
  });
}

export async function removeContact(tenantId: string, contactId: string) {
  const contact = assertTenant(await db.contact.findUnique({ where: { id: contactId } }), tenantId, "Contact");
  await db.contact.delete({ where: { id: contact.id } });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addClientNote(tenantId: string, input: { clientId: string; authorId: string; body: string; pinned?: boolean }) {
  const body = input.body.trim();
  if (!body) throw new Error("Note cannot be empty.");
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const note = await db.clientNote.create({
    data: { tenantId, clientId: input.clientId, authorId: input.authorId, body, pinned: input.pinned ?? false },
  });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId: input.authorId,
    eventType: "NOTE_ADDED",
    summary: "Note added",
    entityType: "CLIENT_NOTE",
    entityId: note.id,
  });
  return note;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function listLeads(tenantId: string) {
  return db.lead.findMany({
    where: { tenantId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { id: true, displayName: true, avatarColor: true } }, client: { select: { id: true, name: true } } },
  });
}

export async function createLead(
  tenantId: string,
  input: {
    title: string;
    personName?: string;
    personEmail?: string;
    personPhone?: string;
    source?: string;
    interest?: string;
    estimatedValue?: number;
    ownerId?: string | null;
  }
) {
  const title = input.title.trim();
  if (!title) throw new Error("Enter what this lead is interested in.");
  return db.lead.create({ data: { tenantId, ...input, title } });
}

export async function updateLeadStatus(tenantId: string, input: { leadId: string; status: string; lostReason?: string }) {
  assertTenant(await db.lead.findUnique({ where: { id: input.leadId } }), tenantId, "Lead");
  return db.lead.update({
    where: { id: input.leadId },
    data: { status: input.status, lostReason: input.status === "LOST" ? input.lostReason : null },
  });
}

/**
 * §17 "Convert" — creates (or reuses, if already linked) a Client for this
 * lead and opens an Opportunity for it in the default pipeline, then marks
 * the lead CONVERTED. The lead record itself is never deleted (history).
 */
export async function convertLead(tenantId: string, input: { leadId: string; actorId: string }) {
  const lead = assertTenant(await db.lead.findUnique({ where: { id: input.leadId } }), tenantId, "Lead");
  if (lead.status === "CONVERTED") throw new Error("This lead has already been converted.");

  return db.$transaction(async (tx) => {
    let clientId = lead.clientId;
    if (!clientId) {
      const client = await tx.client.create({
        data: {
          tenantId,
          name: lead.personName || lead.title,
          email: lead.personEmail,
          phone: lead.personPhone,
          status: "PROSPECT",
          source: lead.source,
          ownerId: lead.ownerId,
          createdById: input.actorId,
        },
      });
      clientId = client.id;
    }

    const pipeline = await tx.pipeline.findFirst({ where: { tenantId, isDefault: true } });
    if (!pipeline) throw new Error("Default pipeline is missing — visit the Pipeline page once first.");
    const firstStage = await tx.pipelineStage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.id }, orderBy: { orderNo: "asc" } });

    const opportunity = await tx.opportunity.create({
      data: {
        tenantId,
        clientId,
        title: lead.title,
        estimatedValue: lead.estimatedValue,
        ownerId: lead.ownerId,
        pipelineId: pipeline.id,
        stageId: firstStage.id,
      },
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED", clientId, convertedOpportunityId: opportunity.id },
    });

    await tx.crmActivityEvent.create({
      data: {
        tenantId,
        clientId,
        actorId: input.actorId,
        eventType: "LEAD_CONVERTED",
        summary: `Lead converted: ${lead.title}`,
        entityType: "LEAD",
        entityId: lead.id,
      },
    });

    return { clientId, opportunityId: opportunity.id };
  });
}

// ---------------------------------------------------------------------------
// Reservations & Sales/Units (PRD_Sales_Dashboard §12/§13) — the deferred
// "Reservation/ClientPurchase" slice the module comment above flagged. Unit
// availability/pricing stays owned by Unit (src/app/(workspace)/projects —
// frozen, read/linked here only); this is the CRM-owned relationship record
// joining Client<->Unit, plus the one place that's allowed to move
// Unit.lifecycleStatus through its existing RESERVED/SOLD/RENTED states as a
// direct consequence of a sales action (Units domain itself isn't frozen).
// ---------------------------------------------------------------------------

export async function recordClientUnitInterest(
  tenantId: string,
  input: { clientId: string; unitId: string; type: "INTERESTED" | "VIEWED" | "RELEASED"; actorId: string }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");
  const rel = await db.clientUnitRelationship.create({
    data: { tenantId, clientId: input.clientId, unitId: input.unitId, type: input.type, createdById: input.actorId },
  });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId: input.actorId,
    eventType: input.type === "INTERESTED" ? "UNIT_INTEREST_RECORDED" : input.type === "VIEWED" ? "UNIT_VIEWED" : "UNIT_RELEASED",
    summary: `${input.type === "INTERESTED" ? "Interest recorded" : input.type === "VIEWED" ? "Unit viewed" : "Reservation released"}: ${unit.code}`,
    entityType: "UNIT",
    entityId: unit.id,
  });
  return rel;
}

export async function createReservation(
  tenantId: string,
  input: {
    clientId: string;
    unitId: string;
    reservationDate: Date;
    expirationDate?: Date | null;
    depositAmount?: number | null;
    depositStatus?: string | null;
    salespersonId: string;
    actorId: string;
  }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");
  if (unit.lifecycleStatus !== "AVAILABLE" && unit.lifecycleStatus !== "ON_HOLD") {
    throw new Error(`This unit is ${unit.lifecycleStatus.toLowerCase().replace("_", " ")}, not available to reserve.`);
  }

  return db.$transaction(async (tx) => {
    const rel = await tx.clientUnitRelationship.create({
      data: {
        tenantId,
        clientId: input.clientId,
        unitId: input.unitId,
        type: "RESERVED",
        reservationDate: input.reservationDate,
        expirationDate: input.expirationDate,
        depositAmount: input.depositAmount,
        depositStatus: input.depositStatus ?? "UNPAID",
        reservationStatus: "ACTIVE",
        salespersonId: input.salespersonId,
        createdById: input.actorId,
      },
    });
    await tx.unit.update({ where: { id: unit.id }, data: { lifecycleStatus: "RESERVED", version: { increment: 1 } } });
    await tx.unitActivityEvent.create({
      data: { tenantId, unitId: unit.id, actorId: input.actorId, eventType: "STATUS_CHANGED", summary: "Reserved via CRM Sales Dashboard" },
    });
    await tx.crmActivityEvent.create({
      data: {
        tenantId,
        clientId: input.clientId,
        actorId: input.actorId,
        eventType: "RESERVATION_CREATED",
        summary: `Reservation created: ${unit.code}`,
        entityType: "UNIT",
        entityId: unit.id,
      },
    });
    return rel;
  });
}

export async function releaseReservation(tenantId: string, input: { relationshipId: string; actorId: string }) {
  const rel = assertTenant(
    await db.clientUnitRelationship.findUnique({ where: { id: input.relationshipId } }),
    tenantId,
    "ClientUnitRelationship"
  );
  if (rel.type !== "RESERVED" || rel.reservationStatus !== "ACTIVE") throw new Error("This reservation is not active.");

  return db.$transaction(async (tx) => {
    const updated = await tx.clientUnitRelationship.update({
      where: { id: rel.id },
      data: { reservationStatus: "RELEASED" },
    });
    const unit = await tx.unit.findUniqueOrThrow({ where: { id: rel.unitId } });
    if (unit.lifecycleStatus === "RESERVED") {
      await tx.unit.update({ where: { id: unit.id }, data: { lifecycleStatus: "AVAILABLE", version: { increment: 1 } } });
    }
    await tx.unitActivityEvent.create({
      data: { tenantId, unitId: unit.id, actorId: input.actorId, eventType: "STATUS_CHANGED", summary: "Reservation released via CRM Sales Dashboard" },
    });
    await tx.crmActivityEvent.create({
      data: {
        tenantId,
        clientId: rel.clientId,
        actorId: input.actorId,
        eventType: "UNIT_RELEASED",
        summary: `Reservation released: ${unit.code}`,
        entityType: "UNIT",
        entityId: unit.id,
      },
    });
    return updated;
  });
}

export async function recordUnitSale(
  tenantId: string,
  input: {
    clientId: string;
    unitId: string;
    type: "PURCHASED" | "RENTED";
    askingPrice?: number | null;
    discount?: number | null;
    finalPrice?: number | null;
    saleDate: Date;
    salespersonId: string;
    actorId: string;
  }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const unit = assertTenant(await db.unit.findUnique({ where: { id: input.unitId } }), tenantId, "Unit");

  return db.$transaction(async (tx) => {
    // A prior active reservation on this unit/client converts rather than
    // staying open — never two live rows disagreeing about the same unit.
    await tx.clientUnitRelationship.updateMany({
      where: { tenantId, unitId: unit.id, clientId: input.clientId, type: "RESERVED", reservationStatus: "ACTIVE" },
      data: { reservationStatus: "CONVERTED" },
    });
    const rel = await tx.clientUnitRelationship.create({
      data: {
        tenantId,
        clientId: input.clientId,
        unitId: input.unitId,
        type: input.type,
        askingPrice: input.askingPrice,
        discount: input.discount,
        finalPrice: input.finalPrice,
        saleDate: input.saleDate,
        salespersonId: input.salespersonId,
        createdById: input.actorId,
      },
    });
    await tx.unit.update({
      where: { id: unit.id },
      data: { lifecycleStatus: input.type === "PURCHASED" ? "SOLD" : "RENTED", version: { increment: 1 } },
    });
    await tx.unitActivityEvent.create({
      data: {
        tenantId,
        unitId: unit.id,
        actorId: input.actorId,
        eventType: "STATUS_CHANGED",
        summary: input.type === "PURCHASED" ? "Sold via CRM Sales Dashboard" : "Rented via CRM Sales Dashboard",
      },
    });
    await tx.crmActivityEvent.create({
      data: {
        tenantId,
        clientId: input.clientId,
        actorId: input.actorId,
        eventType: "UNIT_SALE",
        summary: `${input.type === "PURCHASED" ? "Unit sold" : "Unit rented"}: ${unit.code}`,
        entityType: "UNIT",
        entityId: unit.id,
      },
    });
    return rel;
  });
}

export async function listReservations(tenantId: string) {
  return db.clientUnitRelationship.findMany({
    where: { tenantId, type: "RESERVED" },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      unit: { select: { id: true, code: true, projectId: true, project: { select: { id: true, name: true } } } },
      salesperson: { select: { id: true, displayName: true } },
    },
  });
}

export async function listClientUnitRelationships(tenantId: string) {
  return db.clientUnitRelationship.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      unit: { select: { id: true, code: true, projectId: true, project: { select: { id: true, name: true } } } },
      salesperson: { select: { id: true, displayName: true } },
    },
  });
}

/** Cross-project read-only Units directory for the Sales sidebar — Units'
 * pages/server live under the frozen Projects tree; this queries Unit
 * directly rather than reaching into that code. */
export async function listUnitsDirectory(tenantId: string) {
  return db.unit.findMany({
    where: { tenantId, archivedAt: null },
    orderBy: [{ projectId: "asc" }, { code: "asc" }],
    include: { project: { select: { id: true, name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Communications log (PRD_Sales_Dashboard §17 sidebar item)
// ---------------------------------------------------------------------------

export async function listCommunications(tenantId: string, clientId?: string) {
  return db.crmCommunication.findMany({
    where: { tenantId, clientId },
    orderBy: { occurredAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      loggedBy: { select: { id: true, displayName: true, avatarColor: true } },
    },
  });
}

export async function logCommunication(
  tenantId: string,
  input: {
    clientId: string;
    contactId?: string | null;
    channel: string;
    direction?: string;
    subject?: string;
    notes: string;
    occurredAt?: Date;
    loggedById: string;
  }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const comm = await db.crmCommunication.create({
    data: {
      tenantId,
      clientId: input.clientId,
      contactId: input.contactId ?? null,
      channel: input.channel,
      direction: input.direction ?? "OUTBOUND",
      subject: input.subject,
      notes: input.notes.trim(),
      occurredAt: input.occurredAt ?? new Date(),
      loggedById: input.loggedById,
    },
  });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId: input.loggedById,
    eventType: "COMMUNICATION_LOGGED",
    summary: `${input.channel} logged${input.subject ? `: ${input.subject}` : ""}`,
    entityType: "COMMUNICATION",
    entityId: comm.id,
  });
  return comm;
}

// ---------------------------------------------------------------------------
// Support cases (PRD_Sales_Dashboard §6 After Sales > Support)
// ---------------------------------------------------------------------------

export async function listSupportCases(tenantId: string) {
  return db.supportCase.findMany({
    where: { tenantId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true, avatarColor: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
}

export async function createSupportCase(
  tenantId: string,
  input: { clientId: string; subject: string; description?: string; priority?: string; assignedToId?: string | null; createdById: string }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const subject = input.subject.trim();
  if (!subject) throw new Error("Enter a subject.");
  const supportCase = await db.supportCase.create({
    data: {
      tenantId,
      clientId: input.clientId,
      subject,
      description: input.description,
      priority: input.priority ?? "NORMAL",
      assignedToId: input.assignedToId,
      createdById: input.createdById,
    },
  });
  await logCrmActivity(tenantId, {
    clientId: input.clientId,
    actorId: input.createdById,
    eventType: "SUPPORT_CASE_OPENED",
    summary: `Support case opened: ${subject}`,
    entityType: "SUPPORT_CASE",
    entityId: supportCase.id,
  });
  return supportCase;
}

// ---------------------------------------------------------------------------
// Payments (PRD_Sales_Dashboard §6 sidebar item — "Permission-filtered
// Finance/CRM payment summary entry"). Finance owns Invoice; this reads it
// filtered to contracts with a CLIENT party, same join used by
// getCrmOverview's financial_summary group.
// ---------------------------------------------------------------------------

export async function listClientPayments(tenantId: string) {
  const clientContracts = await db.contractParty.findMany({
    where: { tenantId, partyEntityType: "CLIENT" },
    select: { contractId: true, partyEntityId: true },
  });
  const contractToClientId = new Map(clientContracts.map((c) => [c.contractId, c.partyEntityId]));
  const contractIds = Array.from(contractToClientId.keys());
  if (contractIds.length === 0) return [];

  const invoices = await db.invoice.findMany({
    where: { tenantId, contractId: { in: contractIds } },
    orderBy: { issuedDate: "desc" },
    include: { contract: { select: { id: true, number: true, title: true } } },
  });
  const clientIds = Array.from(new Set(Array.from(contractToClientId.values()).filter((id): id is string => !!id)));
  const clients = clientIds.length ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  return invoices.map((inv) => ({
    ...inv,
    clientId: inv.contractId ? (contractToClientId.get(inv.contractId) ?? null) : null,
    clientName: inv.contractId ? (clientName.get(contractToClientId.get(inv.contractId) ?? "") ?? null) : null,
  }));
}

export async function updateSupportCaseStatus(tenantId: string, input: { caseId: string; status: string }) {
  assertTenant(await db.supportCase.findUnique({ where: { id: input.caseId } }), tenantId, "SupportCase");
  return db.supportCase.update({
    where: { id: input.caseId },
    data: { status: input.status, resolvedAt: input.status === "RESOLVED" || input.status === "CLOSED" ? new Date() : null },
  });
}
