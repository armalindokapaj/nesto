// PRD_CRM_Module — shared between server (src/server/crm-module.ts) and
// client components; deliberately carries no "server-only" import.

// §7 — configurable, not an enum; seeds the picker only.
export const CLIENT_TYPE_SUGGESTIONS = [
  "Buyer",
  "Tenant",
  "Investor",
  "Company",
  "Government",
  "Partner",
  "Prospect",
  "Former Client",
  "VIP",
] as const;

// §16 — configurable, not an enum.
export const CONTACT_ROLE_SUGGESTIONS = [
  "Decision Maker",
  "Legal Representative",
  "Finance Contact",
  "Technical Contact",
  "Sales Contact",
  "Executive Sponsor",
  "Assistant",
  "Family Member",
  "Advisor",
] as const;

// §18 — configurable, not an enum.
export const LEAD_SOURCE_SUGGESTIONS = [
  "Website",
  "Google",
  "Facebook",
  "Instagram",
  "Referral",
  "Walk-in",
  "Phone",
  "Event",
  "Exhibition",
  "Partner",
  "Existing Client",
] as const;

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;

// §22 — the PRD's default pipeline example; ensureDefaultPipeline() seeds
// exactly these, in order, the first time a tenant touches the CRM module.
export const DEFAULT_PIPELINE_STAGES = [
  { name: "Lead", probability: 5 },
  { name: "Contacted", probability: 10 },
  { name: "Qualified", probability: 25 },
  { name: "Meeting", probability: 35 },
  { name: "Site Visit", probability: 45 },
  { name: "Negotiation", probability: 60 },
  { name: "Reservation", probability: 75 },
  { name: "Contract", probability: 85 },
  { name: "Deposit Paid", probability: 95 },
  { name: "Completed", probability: 99 },
  { name: "After Sales", probability: 100 },
] as const;

// PRD_Sales_Dashboard §12/§13 — Reservations & Sales/Units widgets.
export const CLIENT_UNIT_RELATIONSHIP_TYPES = ["INTERESTED", "VIEWED", "RESERVED", "PURCHASED", "RENTED", "RELEASED"] as const;
export type ClientUnitRelationshipType = (typeof CLIENT_UNIT_RELATIONSHIP_TYPES)[number];

export const DEPOSIT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;
export const RESERVATION_STATUSES = ["ACTIVE", "EXPIRED", "CONVERTED", "RELEASED"] as const;

// §17 — CRM communication log.
export const COMMUNICATION_CHANNELS = ["CALL", "EMAIL", "WHATSAPP", "SMS", "MEETING", "IN_PERSON", "OTHER"] as const;
export const COMMUNICATION_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;

// §6 — After Sales > Support sidebar item.
export const SUPPORT_CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const SUPPORT_CASE_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT", "RESOLVED", "CLOSED"] as const;
