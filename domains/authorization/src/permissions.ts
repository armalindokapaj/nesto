/**
 * Authorization permissions — PRD §8, Appendix B.
 *
 * The authority to hand out authority. Every one of these is sensitive and
 * audited, and granting is separated from reading the audit trail on purpose:
 * §24.1 lists support and admin privilege abuse as a first-order threat, and the
 * separation is what makes it detectable.
 */

import type { PermissionDefinition } from "@nesto/contracts";

export const authorizationPermissions: PermissionDefinition[] = [
  {
    key: "membership.grant.read", domain: "authorization",
    description: "See the explicit grants and denies in force for a member.",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.grant.manage", domain: "authorization",
    description: "Add or revoke an explicit permission grant. A grant naming an undeclared permission is refused.",
    actions: ["CREATE", "UPDATE", "DELETE"], allowedScopes: ["COMPANY"], sensitive: true,
    recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "audit.read", domain: "authorization",
    description: "Read the audit trail. Reading it is itself audited (§24.3).",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "audit.export", domain: "authorization",
    description: "Export audit evidence.",
    actions: ["EXPORT"], allowedScopes: ["COMPANY"], sensitive: true,
    recentAuthenticationRequired: true, auditRequired: true,
  },
];
