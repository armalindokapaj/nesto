import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

export async function listClients(tenantId: string) {
  return db.client.findMany({
    where: { tenantId },
    include: { _count: { select: { projects: true } }, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClient(tenantId: string, clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      projects: true,
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      tasks: {
        include: { mainResponsible: true, createdBy: true, sourceComment: { select: { id: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  return assertTenant(client, tenantId, "Client");
}

export async function createClient(
  tenantId: string,
  createdById: string,
  input: { name: string; contactName?: string; email?: string; phone?: string; projectId?: string }
) {
  const { projectId, ...clientInput } = input;
  return db.client.create({
    data: {
      tenantId,
      createdById,
      ...clientInput,
      ...(projectId ? { projects: { connect: { id: projectId } } } : {}),
    },
  });
}
