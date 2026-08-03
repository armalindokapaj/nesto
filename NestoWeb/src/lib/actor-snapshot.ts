import "server-only";
import type { db as dbType } from "@/lib/db";

// PRD_18 §12 "Immutable origin" / §5 "Historical actor snapshot" — no code in
// this repo previously froze who-acted-as-what at the moment of an action
// (TaskApproval/AuditEvent/TaskEvent all store only a raw actorId). This is
// the one shared builder, reused wherever a snapshot is written: DocumentFile
// .uploaderSnapshot, DocumentApproval.approverSnapshot, DomainEvent
// .actorSnapshot.
export type ActorSnapshot = {
  userId: string;
  name: string;
  role: string;
  department: string | null;
  position: string | null;
  companyName: string;
};

type TxOrDb = typeof dbType | Parameters<Parameters<typeof dbType.$transaction>[0]>[0];

export async function buildActorSnapshot(tx: TxOrDb, tenantId: string, userId: string): Promise<ActorSnapshot> {
  const membership = await tx.companyMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    include: { user: true, tenant: { include: { companies: true } } },
  });
  if (!membership) {
    throw new Error("Cannot build actor snapshot: no membership found for this user in this tenant.");
  }
  return {
    userId,
    name: membership.user.displayName,
    role: membership.role,
    department: membership.department,
    position: membership.position,
    // Same "first company" shortcut src/lib/dal.ts's getCurrentUser() uses —
    // multi-company-per-tenant is a deferred PRD_18 §5 gap, not fixed here.
    companyName: membership.tenant.companies[0]?.name ?? "",
  };
}
