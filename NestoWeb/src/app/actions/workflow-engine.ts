"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import {
  createWorkflowDefinition,
  setWorkflowDefinitionActive,
  startWorkflow,
  decide,
  confirmSourceFinalization,
  cancelWorkflow,
  getWorkflowInstance,
} from "@/server/workflow-engine";
import { hasCapability } from "@/server/capabilities";

export type WorkflowActionState = { error: string } | undefined;

const CreateDefinitionSchema = z.object({
  key: z.string().min(2, "Enter a machine key"),
  name: z.string().min(2, "Enter a name"),
  sourceModule: z.string().min(2, "Enter the owning module"),
  sourceEntityType: z.string().min(2, "Enter the entity type"),
  stages: z
    .array(z.object({ name: z.string().min(1), approverRole: z.string().optional(), approverUserId: z.string().optional() }))
    .min(1, "Add at least one stage"),
});

export async function createWorkflowDefinitionAction(input: z.infer<typeof CreateDefinitionSchema>): Promise<WorkflowActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) {
    return { error: "You do not have permission to configure workflows." };
  }
  await assertConfigEnabled(tenantId, "workflow.action.create_definition");

  const parsed = CreateDefinitionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await createWorkflowDefinition(tenantId, user.id, parsed.data);
  revalidatePath("/dashboard/admin/workflows");
  return undefined;
}

export async function setWorkflowDefinitionActiveAction(definitionId: string, isActive: boolean): Promise<WorkflowActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "FULL")) {
    return { error: "You do not have permission to configure workflows." };
  }
  await setWorkflowDefinitionActive(tenantId, user.id, definitionId, isActive);
  revalidatePath("/dashboard/admin/workflows");
  return undefined;
}

/** Any module can call this server-to-server from its own action layer — not exposed directly to a form. */
export async function startWorkflowForRecord(
  tenantId: string,
  actorId: string,
  input: { workflowDefinitionKey: string; sourceEntityId: string; sourceRecordVersion?: number; correlationId?: string }
) {
  return startWorkflow(tenantId, actorId, input);
}

export async function decideWorkItemAction(stageInstanceId: string, decision: "APPROVE" | "REJECT" | "RETURN", comment?: string): Promise<WorkflowActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "workflow.action.decide");
  try {
    await decide(tenantId, user.id, role, stageInstanceId, decision, comment);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record decision." };
  }
  revalidatePath("/workflows");
  return undefined;
}

export async function confirmSourceFinalizationAction(instanceId: string): Promise<WorkflowActionState> {
  const { tenantId, user } = await getCurrentUser();
  try {
    await confirmSourceFinalization(tenantId, user.id, instanceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not finalize workflow." };
  }
  revalidatePath("/workflows");
  return undefined;
}

export async function cancelWorkflowAction(instanceId: string): Promise<WorkflowActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  await assertConfigEnabled(tenantId, "workflow.action.cancel");
  try {
    const instance = await getWorkflowInstance(tenantId, instanceId);
    const isOverride = instance.submittedById !== user.id;
    if (isOverride && !(await hasCapability(tenantId, user.id, role, "workflow.instance.override"))) {
      return { error: "Only the submitter can withdraw this workflow." };
    }
    await cancelWorkflow(tenantId, user.id, instanceId, isOverride);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not cancel workflow." };
  }
  revalidatePath("/workflows");
  return undefined;
}
