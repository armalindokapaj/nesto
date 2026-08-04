"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { canBulkManageUnits } from "@/lib/unit-access";
import { dryRunUnitsImport, commitUnitsImport, type ParsedImportRow } from "@/server/unit-import";

export async function dryRunUnitsImportAction(projectId: string, csvText: string) {
  const { tenantId, role } = await getCurrentUser();
  if (!canBulkManageUnits(role)) {
    throw new Error("You do not have permission to import units.");
  }
  return dryRunUnitsImport(tenantId, projectId, csvText);
}

export async function commitUnitsImportAction(projectId: string, rows: ParsedImportRow[]) {
  const { tenantId, role, user, company } = await getCurrentUser();
  if (!canBulkManageUnits(role)) {
    throw new Error("You do not have permission to import units.");
  }
  if (!company) {
    throw new Error("No company found for this workspace.");
  }
  const result = await commitUnitsImport(tenantId, projectId, company.id, user.id, rows);
  revalidatePath(`/projects/${projectId}/units`);
  return result;
}
