/**
 * Identity permissions — PRD §7, Appendix B.
 *
 * Note what is missing: there is no `identity.user.read` for browsing accounts.
 * An account is global and belongs to a person, not to a company; what a company
 * may see is its own memberships, which is `membership.read` in the organization
 * domain. Conflating the two is how one company learns which other companies a
 * person works for.
 */

import type { PermissionDefinition } from "@nesto/contracts";

export const identityPermissions: PermissionDefinition[] = [
  {
    key: "membership.invite", domain: "identity",
    description: "Invite a person into this company. Single-use, expiring, and counted against the seat limit (§7.3).",
    actions: ["CREATE"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.invite.revoke", domain: "identity",
    description: "Revoke a pending invitation. The record stays as immutable history.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "membership.session.revoke", domain: "identity",
    description: "Revoke another member's sessions.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "membership.mfa.require", domain: "identity",
    description: "Require MFA for members of this company. Mandatory for Owner and Platform Admin regardless (§2).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, auditRequired: true,
  },
  {
    key: "membership.device.manage", domain: "identity",
    description: "Review and revoke registered devices and sessions.",
    actions: ["READ", "UPDATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "platform.admin.manage", domain: "identity",
    description: "Create and remove platform administrators.",
    actions: ["CREATE", "DELETE"], allowedScopes: ["PLATFORM"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "platform.security.read", domain: "identity",
    description: "Read platform security events.",
    actions: ["READ"], allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true,
  },
];
