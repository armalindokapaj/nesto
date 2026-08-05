// PRD_Teams_Module §5/§6 — shared between server (src/server/teams-module.ts)
// and client components, so it deliberately carries no "server-only" import.

// §5 — configurable, not an enum; this only seeds the picker.
export const TEAM_TYPE_SUGGESTIONS = [
  "Permanent",
  "Temporary",
  "Project Team",
  "Cross-Department",
  "Cross-Company",
  "Executive",
  "Sales",
  "Design",
  "Construction",
  "Site",
  "Procurement",
  "Support",
] as const;

// §6 — describes responsibility within the team, not employment position.
export const TEAM_ROLES = [
  "LEADER",
  "DEPUTY_LEADER",
  "COORDINATOR",
  "REVIEWER",
  "CONTRIBUTOR",
  "SPECIALIST",
  "EXTERNAL_MEMBER",
  "OBSERVER",
  "MEMBER",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
