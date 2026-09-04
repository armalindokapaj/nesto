/**
 * The typed module registry of ADR-0014 / PRD §12.10, §23.2.
 *
 * Navigation is generated from this, so a menu entry cannot drift from the guard
 * that protects it. Hiding an item is presentation only: the route guard of
 * §23.4 still runs for anyone who types the URL, and it is authoritative.
 */

import type { Audience } from "./execution-context";

export type ModuleSurface = "COMPANY" | "PROJECT" | "PLATFORM" | "PORTAL" | "PUBLIC";

export type ModuleDefinition = {
  id: string;
  /** Route base, relative to its surface's root. */
  route: string;
  surface: ModuleSurface;
  audiences: Audience[];
  /** Every one of these must hold for the module to be reachable. */
  requiredPermissions: string[];
  /** When set, the module is additionally gated on a feature assignment. */
  featureFlag?: string;
  navLabelKey: string;
  navIcon?: string;
  navOrder: number;
  /** Phase that introduces it, so an unreleased module is absent rather than
   *  broken (§23.2 "hidden modules are absent"). */
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};
