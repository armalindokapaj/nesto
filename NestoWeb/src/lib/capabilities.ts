import type { Role } from "@/lib/constants";

// PRD_Complete_Role_Permission_Matrix — the addressable primitive underneath
// the PRD's formally-specified capability-key model (§10/§33, format
// "<domain>.<resource>.<action>"). This is NOT a replacement for
// src/lib/permissions.ts's can(role, RESOURCE, LEVEL) — that stays the
// coarse "can this role see this section" gate everywhere it already runs.
// This is a narrower, additive layer for the specific cases the PRD's own
// Appendix A names as motivating examples: an action so sensitive that a
// role grant alone shouldn't be the only door, and where a company may need
// to grant (or explicitly revoke) it for one named person regardless of
// their role. See UserCapabilityGrant (schema) / server/capabilities.ts for
// the per-user override on top of the defaults below.

export const CAPABILITY_KEYS = [
  "hse.stop_work.release",
  "hr.compensation.view",
  "workflow.instance.override",
  "notifications.emergency_alert.activate",
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  "hse.stop_work.release": "Release a Stop-Work Order",
  "hr.compensation.view": "View Employee Compensation",
  "workflow.instance.override": "Override / Force-Cancel a Workflow Instance",
  "notifications.emergency_alert.activate": "Activate an Emergency Alert",
};

/** Roles that hold a capability by default — the starting point before any per-user grant/revoke. */
const DEFAULT_CAPABILITY_ROLES: Record<CapabilityKey, Role[]> = {
  "hse.stop_work.release": ["OWNER", "ADMIN", "HSE"],
  "hr.compensation.view": ["OWNER", "ADMIN", "HR", "FINANCE"],
  "workflow.instance.override": ["OWNER", "ADMIN"],
  "notifications.emergency_alert.activate": ["OWNER", "ADMIN", "HSE"],
};

/** Pure default check — no DB. Combined with per-user grants/revokes in server/capabilities.ts. */
export function roleHasCapabilityByDefault(role: Role, key: CapabilityKey): boolean {
  return DEFAULT_CAPABILITY_ROLES[key]?.includes(role) ?? false;
}
