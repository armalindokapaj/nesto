import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

// Phase 1 Track B — AuditEvent rows were written from only nine files, so
// payroll, HR, procurement, legal, QA/QC and most of finance produced no
// forensic trail at all, despite AUDIT_LOGS being a first-class permission
// resource that implies those trails exist.
//
// This does not replace AuditEvent or the existing writers; it gives new
// callers one line instead of a repeated db.auditEvent.create({...}) block,
// and one consistent place to change if the shape ever moves.
//
// `tx` accepts a transaction client so an audit row commits or rolls back with
// the write it describes — an audit trail that survives a failed write is
// worse than none.
export async function logAudit(
  params: {
    tenantId: string;
    actorId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient
) {
  await (tx ?? db).auditEvent.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    },
  });
}
