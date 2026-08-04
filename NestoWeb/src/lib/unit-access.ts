import { can } from "@/lib/permissions";
import { canViewProjectFinance } from "@/lib/project-access";
import type { Role } from "@/lib/constants";

// PRD_Units §3 / PRD_Unit_Page — "Phase 1: every authenticated user can view
// and use every feature... The implementation must still be permission-ready.
// Frontend actions and backend endpoints should call a common authorization
// interface, but the default policy for this phase returns ALLOW." These
// named wrappers ARE that interface — today they just delegate to the
// existing PROJECTS resource gate, so a future Permissions PRD can replace
// their bodies without touching every call site.

export function canViewUnits(role: Role): boolean {
  return can(role, "PROJECTS", "READ");
}

export function canManageUnits(role: Role): boolean {
  return can(role, "PROJECTS", "WRITE");
}

export function canBulkManageUnits(role: Role): boolean {
  return can(role, "PROJECTS", "WRITE");
}

export function canViewUnitCommercial(role: Role): boolean {
  return canViewProjectFinance(role);
}
