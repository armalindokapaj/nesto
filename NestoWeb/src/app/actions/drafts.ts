"use server";

import { getCurrentUser } from "@/lib/dal";
import { getDraft, saveDraft, discardDraft } from "@/server/drafts";

export async function getDraftAction(formKey: string) {
  const { tenantId, user } = await getCurrentUser();
  return getDraft(tenantId, user.id, formKey);
}

export async function saveDraftAction(formKey: string, payload: Record<string, string>) {
  const { tenantId, user } = await getCurrentUser();
  await saveDraft(tenantId, user.id, formKey, payload);
}

export async function discardDraftAction(formKey: string) {
  const { tenantId, user } = await getCurrentUser();
  await discardDraft(tenantId, user.id, formKey);
}
