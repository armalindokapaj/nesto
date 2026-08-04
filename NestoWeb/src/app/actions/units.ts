"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { canManageUnits, canBulkManageUnits } from "@/lib/unit-access";
import * as unitsRepo from "@/server/units";
import { createProjectStructure, createProjectFloor } from "@/server/project-structures";
import { UNIT_TYPES } from "@/lib/constants";

function collectTypeFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("typeField.") && typeof value === "string" && value !== "") {
      fields[key.slice("typeField.".length)] = value;
    }
  }
  return fields;
}

const CreateUnitSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1, "Enter a unit code"),
  type: z.enum(UNIT_TYPES),
  displayName: z.string().optional(),
  structureId: z.string().optional(),
  floorId: z.string().optional(),
  orientation: z.string().optional(),
  view: z.string().optional(),
  features: z.string().optional(),
  notes: z.string().optional(),
  constructionStatus: z.string().optional(),
});

export type UnitActionState = { error: string } | undefined;

export async function createUnitAction(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { tenantId, role, user, company } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to create units." };
  }
  if (!company) {
    return { error: "No company found for this workspace." };
  }

  const parsed = CreateUnitSchema.safeParse({
    projectId: formData.get("projectId"),
    code: formData.get("code"),
    type: formData.get("type"),
    displayName: formData.get("displayName") || undefined,
    structureId: formData.get("structureId") || undefined,
    floorId: formData.get("floorId") || undefined,
    orientation: formData.get("orientation") || undefined,
    view: formData.get("view") || undefined,
    features: formData.get("features") || undefined,
    notes: formData.get("notes") || undefined,
    constructionStatus: formData.get("constructionStatus") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await unitsRepo.createUnit(tenantId, {
      ...parsed.data,
      companyId: company.id,
      createdById: user.id,
      typeFields: collectTypeFields(formData),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create unit." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/units`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  return undefined;
}

const UpdateUnitSchema = CreateUnitSchema.omit({ projectId: true, code: true, type: true }).extend({
  unitId: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(UNIT_TYPES),
  version: z.coerce.number(),
});

export async function updateUnitAction(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to edit units." };
  }

  const parsed = UpdateUnitSchema.safeParse({
    unitId: formData.get("unitId"),
    code: formData.get("code"),
    type: formData.get("type"),
    version: formData.get("version"),
    displayName: formData.get("displayName") || undefined,
    structureId: formData.get("structureId") || undefined,
    floorId: formData.get("floorId") || undefined,
    orientation: formData.get("orientation") || undefined,
    view: formData.get("view") || undefined,
    features: formData.get("features") || undefined,
    notes: formData.get("notes") || undefined,
    constructionStatus: formData.get("constructionStatus") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { unitId, version, ...rest } = parsed.data;
  try {
    const updated = await unitsRepo.updateUnit(tenantId, unitId, user.id, version, {
      ...rest,
      structureId: rest.structureId || null,
      floorId: rest.floorId || null,
      typeFields: collectTypeFields(formData),
    });
    revalidatePath(`/projects/${updated?.projectId}/units/${unitId}`);
    revalidatePath(`/projects/${updated?.projectId}/units`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update unit." };
  }
  return undefined;
}

export async function transitionUnitStatusAction(projectId: string, unitId: string, nextStatus: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    throw new Error("You do not have permission to change unit status.");
  }
  await unitsRepo.transitionUnitStatus(tenantId, unitId, user.id, nextStatus);
  revalidatePath(`/projects/${projectId}/units`);
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
}

const DuplicateUnitSchema = z.object({ unitId: z.string().min(1), projectId: z.string().min(1), code: z.string().min(1, "Enter a code for the new unit") });

export async function duplicateUnitAction(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to duplicate units." };
  }
  const parsed = DuplicateUnitSchema.safeParse({
    unitId: formData.get("unitId"),
    projectId: formData.get("projectId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await unitsRepo.duplicateUnit(tenantId, parsed.data.unitId, user.id, { code: parsed.data.code });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not duplicate unit." };
  }
  revalidatePath(`/projects/${parsed.data.projectId}/units`);
  return undefined;
}

export async function archiveUnitAction(projectId: string, unitId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    throw new Error("You do not have permission to archive units.");
  }
  await unitsRepo.archiveUnit(tenantId, unitId, user.id);
  revalidatePath(`/projects/${projectId}/units`);
  revalidatePath(`/projects/${projectId}`);
}

export async function restoreUnitAction(projectId: string, unitId: string) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canManageUnits(role)) {
    throw new Error("You do not have permission to restore units.");
  }
  await unitsRepo.restoreUnit(tenantId, unitId, user.id);
  revalidatePath(`/projects/${projectId}/units`);
}

export type BulkUpdateInput = { structureId?: string | null; floorId?: string | null; constructionStatus?: string; status?: string };

export async function bulkUpdateUnitsAction(projectId: string, unitIds: string[], input: BulkUpdateInput) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!canBulkManageUnits(role)) {
    throw new Error("You do not have permission to bulk-edit units.");
  }
  const results = await unitsRepo.bulkUpdateUnits(tenantId, unitIds, user.id, input);
  revalidatePath(`/projects/${projectId}/units`);
  return results;
}

const CreateStructureSchema = z.object({ projectId: z.string().min(1), name: z.string().min(1, "Enter a name"), kind: z.string().optional() });

export async function createProjectStructureAction(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to manage project structures." };
  }
  const parsed = CreateStructureSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    kind: formData.get("kind") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createProjectStructure(tenantId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create structure." };
  }
  revalidatePath(`/projects/${parsed.data.projectId}/units`);
  return undefined;
}

const CreateFloorSchema = z.object({ structureId: z.string().min(1), projectId: z.string().min(1), label: z.string().min(1, "Enter a label"), level: z.coerce.number() });

export async function createProjectFloorAction(_prev: UnitActionState, formData: FormData): Promise<UnitActionState> {
  const { tenantId, role } = await getCurrentUser();
  if (!canManageUnits(role)) {
    return { error: "You do not have permission to manage floors." };
  }
  const parsed = CreateFloorSchema.safeParse({
    structureId: formData.get("structureId"),
    projectId: formData.get("projectId"),
    label: formData.get("label"),
    level: formData.get("level"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createProjectFloor(tenantId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create floor." };
  }
  revalidatePath(`/projects/${parsed.data.projectId}/units`);
  return undefined;
}
