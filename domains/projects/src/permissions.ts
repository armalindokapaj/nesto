/**
 * Projects permissions — PRD §12, Appendix B.
 *
 * `project.member.manage` adds someone to a project. It does not give them
 * access: §8.3 requires a valid company membership as well, and the policy
 * engine checks both. Adding a person to a project they have no company
 * membership for produces a row and no capability.
 */

import type { PermissionDefinition } from "@nesto/contracts";

export const projectsPermissions: PermissionDefinition[] = [
  {
    key: "project.read", domain: "projects",
    description: "View a project's identity, state and health.",
    actions: ["READ"], allowedScopes: ["COMPANY", "PROJECT"], sensitive: false, auditRequired: false,
  },
  {
    key: "project.create", domain: "projects",
    description: "Create a project and start idempotent provisioning from an immutable template snapshot (§9.6).",
    actions: ["CREATE"], allowedScopes: ["COMPANY"], sensitive: false, auditRequired: true,
  },
  {
    key: "project.settings.update", domain: "projects",
    description: "Change a project's identity, dates, timezone and manager.",
    actions: ["UPDATE"], allowedScopes: ["PROJECT"], sensitive: false, auditRequired: true,
  },
  {
    key: "project.activate", domain: "projects",
    description: "Move a project from Draft to Active once every activation gate of §12.3 passes.",
    actions: ["APPROVE"], allowedScopes: ["PROJECT"], sensitive: false, auditRequired: true,
  },
  {
    key: "project.state.update", domain: "projects",
    description: "Hold, close, reopen or archive a project. Each requires a reason.",
    actions: ["UPDATE"], allowedScopes: ["PROJECT"], sensitive: false, auditRequired: true,
  },
  {
    key: "project.member.manage", domain: "projects",
    description: "Add and remove project participants. Participation is not access (§8.3).",
    actions: ["CREATE", "UPDATE", "DELETE"], allowedScopes: ["PROJECT"], sensitive: false, auditRequired: true,
  },
  {
    key: "project.health.override", domain: "projects",
    description: "Apply a reasoned, expiring health override. The computed value stays visible alongside it (§12.9).",
    actions: ["UPDATE"], allowedScopes: ["PROJECT"], sensitive: false, auditRequired: true,
  },
  {
    key: "platform.template.publish", domain: "projects",
    description: "Publish an immutable template version, or create a controlled company variation (§9.5).",
    actions: ["CREATE"], allowedScopes: ["PLATFORM"], sensitive: true, auditRequired: true,
  },
];
