// PRD_Contracts_Module — shared between server (src/server/contracts-module.ts)
// and client components; deliberately carries no "server-only" import.

// §11 — configurable, not an enum; seeds the picker only.
export const CONTRACT_TYPE_SUGGESTIONS = [
  "Sales Contract",
  "Purchase Contract",
  "Service Agreement",
  "Construction Contract",
  "Subcontract",
  "Supplier Agreement",
  "Rental or Lease",
  "Reservation Agreement",
  "Framework Agreement",
  "Consultancy Agreement",
  "NDA",
] as const;

// §15 — configurable, not an enum.
export const PARTY_ROLE_SUGGESTIONS = [
  "Client",
  "Buyer",
  "Seller",
  "Employer",
  "Contractor",
  "Subcontractor",
  "Supplier",
  "Consultant",
  "Tenant",
  "Landlord",
  "Guarantor",
] as const;

export const PARTY_ENTITY_TYPES = ["COMPANY", "CLIENT", "CONTACT", "CONTRACTOR", "EMPLOYEE", "EXTERNAL"] as const;

export const OBLIGATION_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "WAIVED"] as const;
export const OBLIGATION_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export const MILESTONE_STATUSES = ["PENDING", "DUE", "COMPLETED", "DELAYED"] as const;
