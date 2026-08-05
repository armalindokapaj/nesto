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

export { CLIENT_TYPE_SUGGESTIONS, CONTACT_ROLE_SUGGESTIONS, LEAD_SOURCE_SUGGESTIONS, LEAD_STATUSES, LEAD_PRIORITIES } from "@/lib/crm-constants";

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

export async function moveOpportunityStage(tenantId: string, input: { opportunityId: string; stageId: string }) {
  const opp = assertTenant(await db.opportunity.findUnique({ where: { id: input.opportunityId } }), tenantId, "Opportunity");
  const stage = assertTenant(await db.pipelineStage.findUnique({ where: { id: input.stageId } }), tenantId, "PipelineStage");
  if (stage.pipelineId !== opp.pipelineId) throw new Error("Stage belongs to a different pipeline.");
  return db.opportunity.update({
    where: { id: input.opportunityId },
    data: { stageId: input.stageId, stageEnteredAt: new Date() },
  });
}

export async function closeOpportunity(tenantId: string, input: { opportunityId: string; status: "WON" | "LOST"; lostReason?: string }) {
  assertTenant(await db.opportunity.findUnique({ where: { id: input.opportunityId } }), tenantId, "Opportunity");
  return db.opportunity.update({
    where: { id: input.opportunityId },
    data: { status: input.status, lostReason: input.status === "LOST" ? input.lostReason : null },
  });
}

export async function createOpportunity(
  tenantId: string,
  input: { clientId: string; title: string; contactId?: string | null; estimatedValue?: number | null; ownerId?: string | null }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  const pipeline = await ensureDefaultPipeline(tenantId);
  const firstStage = await db.pipelineStage.findFirstOrThrow({ where: { tenantId, pipelineId: pipeline.id }, orderBy: { orderNo: "asc" } });

  return db.opportunity.create({
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
  input: { clientId: string; name: string; title?: string; department?: string; email?: string; phone?: string; role?: string }
) {
  assertTenant(await db.client.findUnique({ where: { id: input.clientId } }), tenantId, "Client");
  return db.contact.create({ data: { tenantId, ...input, name: input.name.trim() } });
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
  return db.clientNote.create({ data: { tenantId, clientId: input.clientId, authorId: input.authorId, body, pinned: input.pinned ?? false } });
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

    return { clientId, opportunityId: opportunity.id };
  });
}
