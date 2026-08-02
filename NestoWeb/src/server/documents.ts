import { db } from "@/lib/db";

export async function listDocuments(tenantId: string) {
  return db.documentFile.findMany({
    where: { tenantId },
    include: { project: true, uploadedBy: true, task: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listTaskDocuments(tenantId: string, taskId: string) {
  return db.documentFile.findMany({
    where: { tenantId, taskId },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listProjectDocuments(tenantId: string, projectId: string) {
  return db.documentFile.findMany({
    where: { tenantId, projectId },
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDocument(
  tenantId: string,
  input: { name: string; category?: string; projectId?: string; taskId?: string; clientId?: string; uploadedById: string }
) {
  return db.documentFile.create({
    data: {
      tenantId,
      name: input.name,
      category: input.category ?? "General",
      projectId: input.projectId,
      taskId: input.taskId,
      clientId: input.clientId,
      uploadedById: input.uploadedById,
    },
  });
}
