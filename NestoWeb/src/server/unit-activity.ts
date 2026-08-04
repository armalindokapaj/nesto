import "server-only";
import { db } from "@/lib/db";

export async function logUnitActivity(
  tenantId: string,
  unitId: string,
  actorId: string,
  eventType: string,
  summary: string,
  metadata?: Record<string, unknown>
) {
  await db.unitActivityEvent.create({
    data: {
      tenantId,
      unitId,
      actorId,
      eventType,
      summary,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}

export async function listUnitActivity(tenantId: string, unitId: string) {
  return db.unitActivityEvent.findMany({
    where: { tenantId, unitId },
    include: { actor: { select: { displayName: true, avatarColor: true } } },
    orderBy: { createdAt: "desc" },
  });
}
