"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { createComparison, recordComparisonScore, completeComparison, recommendAward, decideAward, createPurchaseOrderFromAward, COMPARISON_CRITERIA } from "@/server/procurement-comparison";

export type ProcurementActionState = { error?: string; success?: string } | undefined;

async function procurementContext() {
  const current = await getCurrentUser();
  if (!can(current.role, "PROCUREMENT", "WRITE")) throw new Error("You do not have permission to manage procurement.");
  return current;
}

function actionError(error: unknown, fallback: string): ProcurementActionState {
  return { error: error instanceof Error ? error.message : fallback };
}

const CreateComparisonSchema = z.object({ rfqId: z.string().min(1) });

export async function createComparisonAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  const parsed = CreateComparisonSchema.safeParse({ rfqId: formData.get("rfqId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const { tenantId, user } = await procurementContext();
    await createComparison(tenantId, user.id, parsed.data);
  } catch (error) {
    return actionError(error, "Could not create comparison");
  }
  revalidatePath("/dashboard/procurement/sourcing/comparisons");
  return { success: "Comparison created" };
}

export async function recordComparisonScoreAction(comparisonId: string, quotationId: string, criterion: (typeof COMPARISON_CRITERIA)[number], score: number) {
  const { tenantId, user } = await procurementContext();
  await recordComparisonScore(tenantId, user.id, { comparisonId, quotationId, criterion, score });
  revalidatePath(`/dashboard/procurement/sourcing/comparisons/${comparisonId}`);
}

export async function completeComparisonAction(id: string) {
  const { tenantId, user } = await procurementContext();
  await completeComparison(tenantId, user.id, id);
  revalidatePath(`/dashboard/procurement/sourcing/comparisons/${id}`);
}

const RecommendAwardSchema = z.object({ comparisonId: z.string().min(1), recommendedQuotationId: z.string().min(1), justification: z.string().optional() });

export async function recommendAwardAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  const parsed = RecommendAwardSchema.safeParse({
    comparisonId: formData.get("comparisonId"),
    recommendedQuotationId: formData.get("recommendedQuotationId"),
    justification: formData.get("justification") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  try {
    const { tenantId, user } = await procurementContext();
    await recommendAward(tenantId, user.id, parsed.data);
  } catch (error) {
    return actionError(error, "Could not recommend award");
  }
  revalidatePath("/dashboard/procurement/sourcing/awards");
  return { success: "Award recommended" };
}

export async function decideAwardAction(id: string, decision: "APPROVED" | "REJECTED", note?: string) {
  const current = await getCurrentUser();
  if (!can(current.role, "PROCUREMENT", "FULL")) throw new Error("Approving an award requires full Procurement authority.");
  await decideAward(current.tenantId, current.user.id, id, decision, note);
  revalidatePath("/dashboard/procurement/sourcing/awards");
  revalidatePath(`/dashboard/procurement/sourcing/awards/${id}`);
}

export async function createPurchaseOrderFromAwardAction(id: string) {
  const { tenantId, user } = await procurementContext();
  const order = await createPurchaseOrderFromAward(tenantId, user.id, id);
  revalidatePath(`/dashboard/procurement/sourcing/awards/${id}`);
  revalidatePath("/dashboard/procurement/orders");
  return order;
}
