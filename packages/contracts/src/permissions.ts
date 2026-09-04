/**
 * The permission manifest shape of PRD Appendix B, and the scope vocabulary of
 * §8.4.
 *
 * Permissions are *declared* data, not scattered string literals. Each domain
 * exports its manifest; the union is the platform's vocabulary, and an
 * architecture test fails the build when code uses a key nobody declared. That
 * is what keeps §8's "deny by default" honest — you cannot invent authority by
 * typing a new string.
 */

export type PermissionAction = "READ" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT" | "SHARE";

export type PermissionScope = "PLATFORM" | "COMPANY" | "PROJECT" | "OWN" | "ASSIGNED" | "EXTERNAL_SHARED";

export type PermissionDefinition = {
  key: string;
  domain: string;
  description: string;
  actions: PermissionAction[];
  allowedScopes: PermissionScope[];
  /** Sensitive permissions imply field-level rules beyond the route check
   *  (§8.5) and stricter export policy. */
  sensitive: boolean;
  recentAuthenticationRequired?: boolean;
  auditRequired: boolean;
};

/** The 14 protected base company roles of §8.2. Companies may relabel these for
 *  display; they may not change what they mean. */
export const BASE_ROLES = [
  "OWNER",
  "COMPANY_ADMIN",
  "EXECUTIVE",
  "PROJECT_MANAGER",
  "ARCHITECT",
  "ENGINEER",
  "FINANCE",
  "PROCUREMENT",
  "HR",
  "SALES",
  "HSE",
  "QA_QC",
  "IT",
  "FIELD",
] as const;
export type BaseRole = (typeof BASE_ROLES)[number];

/** The 5 project roles of §8.3. Holding one grants nothing on its own: the user
 *  must already hold a valid company membership and project membership. */
export const PROJECT_ROLES = ["MANAGER", "PLANNER", "COORDINATOR", "CONTRIBUTOR", "VIEWER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** The domain prefixes of Appendix B. A permission key must start with one. */
export const PERMISSION_DOMAINS = [
  "platform", "company", "organization", "membership", "project", "physical", "wbs", "task",
  "schedule", "document", "rfi", "submittal", "design_change", "variation", "contract", "finance",
  "procurement", "inventory", "site", "progress", "qaqc", "hse", "hr", "crm", "network", "job",
  "tender", "workflow", "report", "audit",
] as const;
export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

export function isValidPermissionKey(key: string): boolean {
  const prefix = key.split(".")[0];
  return (
    typeof prefix === "string" &&
    (PERMISSION_DOMAINS as readonly string[]).includes(prefix) &&
    /^[a-z_]+(\.[a-z_]+)+$/.test(key)
  );
}

/** A policy decision (ADR-0004). `fields` is the allowlist a repository selects;
 *  a column absent from it is never read, so it cannot leak downstream. */
export type PolicyDecision = {
  allow: boolean;
  /** undefined means "every field this DTO declares"; a set means exactly these. */
  fields?: ReadonlySet<string>;
  /** Internal only — why the decision went the way it did. Never serialized. */
  reasons: string[];
};

export const ALLOW_ALL_FIELDS: PolicyDecision = { allow: true, reasons: ["allow"] };
export const DENY: PolicyDecision = { allow: false, reasons: ["deny-by-default"] };
