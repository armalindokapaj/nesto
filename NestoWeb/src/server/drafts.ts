import "server-only";
import { db } from "@/lib/db";

// PRD_Platform_UI_UX_Architecture §18 Universal Draft Mode — the primitive.
// One draft slot per (user, form); saving never touches any other record
// (no number allocated, nobody notified, no business-rule check run) —
// exactly the PRD's "Manual Save separates work preservation from business
// consequence."

export async function getDraft(tenantId: string, userId: string, formKey: string) {
  const draft = await db.recordDraft.findUnique({ where: { tenantId_userId_formKey: { tenantId, userId, formKey } } });
  return draft ? { payload: JSON.parse(draft.payload) as Record<string, string>, updatedAt: draft.updatedAt } : null;
}

export async function saveDraft(tenantId: string, userId: string, formKey: string, payload: Record<string, string>) {
  await db.recordDraft.upsert({
    where: { tenantId_userId_formKey: { tenantId, userId, formKey } },
    create: { tenantId, userId, formKey, payload: JSON.stringify(payload) },
    update: { payload: JSON.stringify(payload) },
  });
}

/** Called once the form actually submits — the draft's job is done, keeping it around would just be stale clutter. */
export async function discardDraft(tenantId: string, userId: string, formKey: string) {
  await db.recordDraft.deleteMany({ where: { tenantId, userId, formKey } });
}
