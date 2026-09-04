/**
 * The base role matrix — PRD §8.2.
 *
 * Fourteen protected roles, each with an **allowlist** of permission patterns.
 * Deny by default means a role holds nothing it is not listed for; there is no
 * "everything except" entry anywhere below except OWNER, and even that one is
 * bounded to the company domains.
 *
 * Patterns use a single trailing `*` (`finance.*`) or an exact key. Wildcards in
 * the middle are rejected, because `*.read` reads as harmless and is not.
 *
 * A role gives *route and action* authority. It never decides which records the
 * holder sees — that is scope and record policy, evaluated afterwards. So
 * FINANCE having `finance.*` does not mean Finance sees every project's numbers;
 * it means Finance may perform finance actions on whatever is in scope.
 */

import type { BaseRole } from "@nesto/contracts";

export type RolePermissions = {
  /** Permission patterns this role holds by default. */
  allow: string[];
  /** Patterns explicitly withheld, which beat `allow`. Used for the Owner
   *  boundary: Company Admin is broad, but not over the Owner. */
  deny?: string[];
  note: string;
};

/** Permissions that only the Primary Owner may exercise (§8.6). */
export const OWNER_ONLY = [
  "company.owner.transfer",
  "company.owner.assign",
  "membership.owner.manage",
  "company.delete.request",
];

export const ROLE_MATRIX: Record<BaseRole, RolePermissions> = {
  OWNER: {
    allow: [
      "company.*", "organization.*", "membership.*", "project.*", "physical.*", "wbs.*", "task.*",
      "schedule.*", "document.*", "rfi.*", "submittal.*", "design_change.*", "variation.*",
      "contract.*", "finance.*", "procurement.*", "inventory.*", "site.*", "progress.*", "qaqc.*",
      "hse.*", "hr.*", "crm.*", "network.*", "job.*", "tender.*", "workflow.*", "report.*", "audit.*",
    ],
    note: "Everything inside the company. Never anything under platform.* — Platform Control is a different audience entirely (§3.1).",
  },

  COMPANY_ADMIN: {
    allow: [
      "company.*", "organization.*", "membership.*", "project.*", "physical.*", "wbs.*", "task.*",
      "schedule.*", "document.*", "rfi.*", "submittal.*", "design_change.*", "variation.*",
      "contract.*", "procurement.*", "inventory.*", "site.*", "progress.*", "qaqc.*", "hse.*",
      "crm.*", "network.*", "job.*", "tender.*", "workflow.*", "report.*", "audit.read",
    ],
    deny: [...OWNER_ONLY, "finance.*", "hr.salary.*", "hr.medical.*", "hr.disciplinary.*"],
    note: "Broad administration, but not Owner authority and not the restricted field families. §8.6: Company Admin cannot create, promote, modify, disable or replace the Owner. Finance and sensitive HR are separate roles precisely so an administrator does not also see payroll.",
  },

  EXECUTIVE: {
    allow: [
      "company.read", "organization.read", "membership.read", "project.read", "physical.read",
      "wbs.read", "task.read", "schedule.read", "document.read", "rfi.read", "submittal.read",
      "design_change.read", "variation.read", "variation.approve", "contract.read", "contract.approve",
      "finance.read", "finance.budget.approve", "procurement.read", "procurement.award.approve",
      "inventory.read", "site.read", "progress.read", "qaqc.read", "hse.read", "crm.read",
      "network.read", "tender.read", "tender.award.approve", "workflow.approval.decide", "report.read",
    ],
    note: "Sees widely and approves at the top of the chain. Creates and edits almost nothing: an executive who can quietly rewrite a budget line is how reconciliation breaks.",
  },

  PROJECT_MANAGER: {
    allow: [
      "project.read", "project.settings.update", "project.member.manage", "project.activate",
      "physical.*", "wbs.*", "task.*", "schedule.*", "document.read", "document.create",
      "document.revision.create", "rfi.*", "submittal.*", "design_change.read", "design_change.create",
      "variation.read", "variation.create", "contract.read", "procurement.read", "inventory.read",
      "site.*", "progress.*", "qaqc.read", "qaqc.inspection.request", "hse.read", "hse.incident.create",
      "report.read", "workflow.approval.decide",
    ],
    note: "Runs the project. Reads commercial data, changes none of it — Finance owns money and Contracts owns legal state (§4.2).",
  },

  ARCHITECT: {
    allow: [
      "project.read", "physical.read", "wbs.read", "task.read", "task.update.assigned",
      "document.*", "rfi.*", "submittal.*", "design_change.*", "variation.read", "variation.create",
      "site.read", "progress.read", "qaqc.read", "report.read",
    ],
    note: "Owns drawings and design intent. May raise a variation but not approve one — §13.4 keeps design consequence and commercial change apart.",
  },

  ENGINEER: {
    allow: [
      "project.read", "physical.read", "wbs.read", "task.read", "task.update.assigned",
      "document.read", "document.create", "document.revision.create", "rfi.*", "submittal.*",
      "design_change.read", "design_change.create", "site.*", "progress.*",
      "qaqc.read", "qaqc.inspection.request", "hse.read", "hse.incident.create", "report.read",
    ],
    note: "Execution and measurement. Records progress; does not certify it — certification is an explicit workflow (§13.6).",
  },

  FINANCE: {
    allow: [
      "finance.*", "contract.read", "procurement.read", "inventory.read", "project.read",
      "crm.read", "report.read", "report.finance.read", "document.read", "workflow.approval.decide",
    ],
    note: "The authoritative owner of money (§4.2). Reads the operational context it needs to code a cost and nothing more.",
  },

  PROCUREMENT: {
    allow: [
      "procurement.*", "tender.*", "contract.read", "inventory.read", "inventory.receipt.read",
      "project.read", "wbs.read", "document.read", "document.create", "network.read", "report.read",
      "workflow.approval.decide",
    ],
    deny: ["procurement.tender.award.approve", "tender.award.approve"],
    note: "Runs sourcing and selects a preferred bidder — but §8.6 and §17.5 make that selection final only after a central approval this role does not hold.",
  },

  HR: {
    allow: [
      "hr.*", "organization.read", "organization.department.manage", "membership.read",
      "job.*", "document.read", "report.read", "project.read",
    ],
    note: "Owns employment. Note what is absent: membership.manage. Hiring never creates an account (§16.3) and HR does not grant system access — that is IT plus an explicit invitation.",
  },

  SALES: {
    allow: [
      "crm.*", "project.read", "document.read", "network.read", "contract.read", "report.read",
      "finance.receivable.read",
    ],
    note: "Owns the client relationship and the pipeline. Sees what a client owes, not the company's cost base.",
  },

  HSE: {
    allow: [
      "hse.*", "project.read", "physical.read", "wbs.read", "site.read", "task.read", "task.create",
      "document.read", "report.read", "workflow.approval.decide",
    ],
    note: "Owns safety evidence. May raise a corrective-action task; the task's own assignment rules still apply (§13.8).",
  },

  QA_QC: {
    allow: [
      "qaqc.*", "project.read", "physical.read", "wbs.read", "site.read", "progress.read",
      "document.read", "task.read", "task.create", "report.read", "workflow.approval.decide",
    ],
    note: "Owns acceptance. Reads physical progress and cannot change it: completion is not acceptance (§13.7).",
  },

  IT: {
    allow: [
      "company.settings.read", "organization.read", "membership.read", "membership.invite",
      "membership.suspend", "membership.device.manage", "project.read", "report.read",
    ],
    deny: [...OWNER_ONLY, "audit.*", "finance.*", "hr.*"],
    note: "Provisions and suspends access. Explicitly not an audit reader: the role that grants access must not also be the role that curates the record of who granted it.",
  },

  FIELD: {
    allow: [
      "project.read", "physical.read", "wbs.read", "task.read", "task.update.assigned",
      "site.daily_report.create", "site.read", "progress.create", "progress.read",
      "document.read", "hse.incident.create", "hse.read", "qaqc.inspection.request",
    ],
    note: "Site execution on a phone. Reads the plan, updates assigned work, reports what happened. No commercial visibility at all.",
  },
};

const WILDCARD = /^([a-z_]+(?:\.[a-z_]+)*)\.\*$/;

export function patternMatches(pattern: string, key: string): boolean {
  const wildcard = WILDCARD.exec(pattern);
  if (wildcard) {
    const prefix = wildcard[1] as string;
    return key === prefix || key.startsWith(`${prefix}.`);
  }
  return pattern === key;
}

/** Deny beats allow, always (§8.1 "explicit deny wins"). */
export function roleGrants(role: BaseRole, key: string): boolean {
  const entry = ROLE_MATRIX[role];
  if (entry.deny?.some((p) => patternMatches(p, key))) return false;
  return entry.allow.some((p) => patternMatches(p, key));
}
