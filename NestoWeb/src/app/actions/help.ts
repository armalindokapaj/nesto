"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createSuggestion } from "@/server/suggestions";

const SuggestionSchema = z.object({
  message: z.string().min(10, "Tell us a bit more — at least 10 characters."),
});

export type SubmitSuggestionState = { error: string } | { success: true } | undefined;

export async function submitSuggestionAction(
  _prev: SubmitSuggestionState,
  formData: FormData
): Promise<SubmitSuggestionState> {
  const { tenantId, user } = await getCurrentUser();

  const parsed = SuggestionSchema.safeParse({ message: formData.get("message") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createSuggestion(tenantId, user.id, parsed.data.message);
  revalidatePath("/help");
  return { success: true };
}
