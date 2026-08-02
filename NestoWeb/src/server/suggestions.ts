import { db } from "@/lib/db";

export async function createSuggestion(tenantId: string, userId: string, message: string) {
  return db.suggestion.create({ data: { tenantId, userId, message } });
}

export async function listMySuggestions(tenantId: string, userId: string) {
  return db.suggestion.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}
