"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { dryRunImport, commitImport, type ImportableEntity } from "@/server/import-center";

function requirePermission(role: Parameters<typeof can>[0], entity: ImportableEntity) {
  const ok = entity === "EMPLOYEES" ? can(role, "HR", "WRITE") : can(role, "CLIENTS", "WRITE");
  if (!ok) throw new Error("You do not have permission to import this record type.");
}

export async function dryRunImportAction(entity: ImportableEntity, csvText: string) {
  const { tenantId, role } = await getCurrentUser();
  requirePermission(role, entity);
  return dryRunImport(tenantId, entity, csvText);
}

export async function commitImportAction(entity: ImportableEntity, rows: Parameters<typeof commitImport>[3]) {
  const { tenantId, role, user } = await getCurrentUser();
  requirePermission(role, entity);
  const result = await commitImport(tenantId, user.id, entity, rows);
  revalidatePath("/dashboard/admin/import");
  if (entity === "EMPLOYEES") revalidatePath("/dashboard/hr/employees");
  if (entity === "CLIENTS") revalidatePath("/clients");
  return result;
}
