/**
 * Organization permissions — PRD §14.7, Appendix B.
 *
 * `organization.department.manage` is deliberately *not* a permission-granting
 * capability. §2 and §14.7 both say it outright: a department organises
 * reporting and never grants business-data access. Someone who can restructure
 * the org chart gains no visibility by doing so.
 */

import type { PermissionDefinition } from "@nesto/contracts";

export const organizationPermissions: PermissionDefinition[] = [
  {
    key: "organization.read", domain: "organization",
    description: "View departments and the reporting structure.",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: false,
  },
  {
    key: "organization.department.manage", domain: "organization",
    description: "Create and restructure departments. Grants no data access — department is not permission.",
    actions: ["CREATE", "UPDATE", "DELETE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "membership.read", domain: "organization",
    description: "View this company's members and their roles.",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: false,
  },
  {
    key: "membership.role.update", domain: "organization",
    description: "Change a member's base role. Bumps their security stamp, so the change takes effect on their next request.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.suspend", domain: "organization",
    description: "Suspend a member's access to this company without ending their employment record.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.end", domain: "organization",
    description: "End a membership. Offboarding revokes access separately from preserving history (§14.7).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.owner.manage", domain: "organization",
    description: "Act on the Primary Owner membership. Owner only (§8.6).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
];
