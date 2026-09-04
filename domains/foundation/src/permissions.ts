/**
 * The foundation domain's permission manifest — PRD Appendix B.
 *
 * `platform.*` keys are exercised only in the PLATFORM audience; the policy
 * engine refuses them anywhere else, and refuses everything else *to* that
 * audience (§24.5, ACC-12).
 */

import type { PermissionDefinition } from "@nesto/contracts";

export const foundationPermissions: PermissionDefinition[] = [
  // --- Platform Control (§3.1) ------------------------------------------
  {
    key: "platform.company.read", domain: "foundation",
    description: "View company records in the control plane. Metadata only — never operational tenant data.",
    actions: ["READ"], allowedScopes: ["PLATFORM"], sensitive: false, auditRequired: true,
  },
  {
    key: "platform.company.create", domain: "foundation",
    description: "Create a company candidate.",
    actions: ["CREATE"], allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true,
  },
  {
    key: "platform.company.activate", domain: "foundation",
    description: "Activate a company and issue the Primary Owner invitation (§9.3).",
    actions: ["APPROVE"], allowedScopes: ["PLATFORM"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "platform.company.suspend", domain: "foundation",
    description: "Suspend a company into the 120-hour read-only grace, or lock it immediately on a documented security incident.",
    actions: ["UPDATE"], allowedScopes: ["PLATFORM"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "platform.company.reactivate", domain: "foundation",
    description: "Return a suspended or locked company to service.",
    actions: ["UPDATE"], allowedScopes: ["PLATFORM"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "platform.company.delete", domain: "foundation",
    description: "Confirm final deletion of an eligible company. Never automatic (§9.2).",
    actions: ["DELETE"], allowedScopes: ["PLATFORM"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "platform.company.verify", domain: "foundation",
    description: "Decide a company verification review.",
    actions: ["APPROVE"], allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true,
  },
  {
    key: "platform.legal.publish", domain: "foundation",
    description: "Publish an immutable legal document version.",
    actions: ["CREATE"], allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true,
  },
  {
    key: "platform.feature.manage", domain: "foundation",
    description: "Assign module and feature availability (ADR-0014).",
    actions: ["UPDATE"], allowedScopes: ["PLATFORM"], sensitive: false, auditRequired: true,
  },

  // --- Company-side (§3.2) ----------------------------------------------
  {
    key: "company.read", domain: "foundation",
    description: "View the company profile and settings.",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: false,
  },
  {
    key: "company.settings.read", domain: "foundation",
    description: "View regional settings.",
    actions: ["READ"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: false,
  },
  {
    key: "company.settings.update", domain: "foundation",
    description: "Change language, timezone, currency and workweek defaults.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "company.profile.update", domain: "foundation",
    description: "Change the company's display identity. Verified legal fields stay Platform-controlled (§15.2).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "company.branch.manage", domain: "foundation",
    description: "Create and maintain branches.",
    actions: ["CREATE", "UPDATE", "DELETE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "company.owner.transfer", domain: "foundation",
    description: "Transfer Primary Ownership. Owner only, with recent authentication and recipient MFA (§8.6).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "company.owner.assign", domain: "foundation",
    description: "Name the Primary Owner. Owner only.",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "company.delete.request", domain: "foundation",
    description: "Request deletion of the company. Owner only; Platform Admin still confirms (§9.2).",
    actions: ["DELETE"], allowedScopes: ["COMPANY"], sensitive: true, recentAuthenticationRequired: true, auditRequired: true,
  },
  {
    key: "company.onboarding.complete", domain: "foundation",
    description: "Complete guided onboarding (§9.4).",
    actions: ["UPDATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
];
