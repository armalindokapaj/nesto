import { db } from "@/lib/db";

export async function listComments(tenantId: string, targetType: string, targetId: string) {
  return db.comment.findMany({
    where: { tenantId, targetType, targetId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComment(
  tenantId: string,
  authorId: string,
  input: { targetType: string; targetId: string; body: string }
) {
  return db.comment.create({ data: { tenantId, authorId, ...input } });
}
