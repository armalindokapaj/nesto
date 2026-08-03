import "server-only";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { MODULES, type ModuleKey } from "@/lib/modules";

// Absence of a row means enabled — a non-disruptive default so existing
// tenants keep every feature they already had; only an explicit disabled
// row hides a module's nav items via visibleNavSections().
export async function getDisabledModules(tenantId: string): Promise<Set<ModuleKey>> {
  const rows = await db.companyModule.findMany({ where: { tenantId, enabled: false } });
  return new Set(rows.map((r) => r.moduleKey as ModuleKey));
}

export async function listModuleStates(tenantId: string): Promise<{ key: ModuleKey; enabled: boolean }[]> {
  const disabled = await getDisabledModules(tenantId);
  return MODULES.map((key) => ({ key, enabled: !disabled.has(key) }));
}

export async function setModuleEnabled(tenantId: string, role: Role, moduleKey: ModuleKey, enabled: boolean) {
  // Matches this Subscription page's own edit gate (see UpdatePlanForm),
  // rather than the page's broader USER_MANAGEMENT:READ view gate.
  if (!can(role, "COMPANY_SETTINGS", "FULL")) throw new Error("You do not have permission to manage modules.");
  await db.companyModule.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
    create: { tenantId, moduleKey, enabled },
    update: { enabled },
  });
}
