// Per-company module registry catalog — mirrors how RESOURCES is declared in
// permissions.ts. Each key can be independently enabled/disabled per tenant
// via CompanyModule; absence of a row means enabled (see company-modules.ts).
export const MODULES = [
  "PROJECTS",
  "TASKS",
  "FINANCE",
  "HR",
  "CONTRACTS",
  "COMPANY_NETWORK",
  "CLIENTS",
  "HSE_REPORTS",
  "PROCUREMENT",
  "ASSETS",
  "TRAINING",
  "LEGAL",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  PROJECTS: "Projects",
  TASKS: "Tasks",
  FINANCE: "Finance",
  HR: "HR",
  CONTRACTS: "Contracts",
  COMPANY_NETWORK: "Contractors",
  CLIENTS: "Clients",
  HSE_REPORTS: "HSE Reports",
  PROCUREMENT: "Procurement",
  ASSETS: "Assets",
  TRAINING: "Training",
  LEGAL: "Legal & Compliance",
};
