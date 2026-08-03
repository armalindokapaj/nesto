import "server-only";
import { db } from "@/lib/db";
import { registerDomainEventHandler } from "@/lib/domain-events";

// PRD_18 §11 reference reaction for the Document Passport slice, mirroring
// contract-lifecycle-reactions.ts's shape: a downstream module (here, the
// Task a document is attached to) reacts to the event rather than being
// written to directly by the approval code.

registerDomainEventHandler("DocumentRevisionApproved", async (payload, event) => {
  const { documentFileId, name, taskId } = payload as {
    documentFileId: string;
    name: string;
    taskId: string | null;
  };

  await db.auditEvent.create({
    data: {
      tenantId: event.tenantId,
      actorId: event.actorUserId,
      action: "DOCUMENT_REVISION_APPROVED",
      targetType: "DocumentFile",
      targetId: documentFileId,
      metadata: JSON.stringify({ name }),
    },
  });

  if (!taskId) return;
  const task = await db.task.findUnique({ where: { id: taskId }, select: { mainResponsibleId: true } });
  if (!task?.mainResponsibleId) return;

  await db.notification.create({
    data: {
      tenantId: event.tenantId,
      userId: task.mainResponsibleId,
      type: "DOCUMENT_REVISION_APPROVED",
      title: "Document approved",
      body: name,
      link: `/documents/${documentFileId}`,
    },
  });
});
