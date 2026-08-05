// PRD_Inventory_Module — shared between server (src/server/inventory-module.ts)
// and client components; deliberately carries no "server-only" import.

export const PRODUCT_TRACKING_TYPES = ["NONE", "BATCH", "SERIAL"] as const;
export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;

// §24 Stock Movements — collapsed from the PRD's fuller list (which also
// covers Reservation/Production/Project/Maintenance consumption — all
// deferred, they belong to modules or sub-features not built yet).
export const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE", "RETURN_IN", "RETURN_OUT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// Which side of a movement line is required for each type — drives both
// validation (src/server/inventory-module.ts) and the create-movement form.
export const MOVEMENT_DIRECTION: Record<MovementType, { requiresFrom: boolean; requiresTo: boolean }> = {
  RECEIPT: { requiresFrom: false, requiresTo: true },
  ISSUE: { requiresFrom: true, requiresTo: false },
  TRANSFER: { requiresFrom: true, requiresTo: true },
  ADJUSTMENT_INCREASE: { requiresFrom: false, requiresTo: true },
  ADJUSTMENT_DECREASE: { requiresFrom: true, requiresTo: false },
  RETURN_IN: { requiresFrom: false, requiresTo: true },
  RETURN_OUT: { requiresFrom: true, requiresTo: false },
};

// §25 Movement Lifecycle — collapsed to the same DRAFT/POSTED/CANCELLED/
// REVERSED shape as Finance's JournalEntry (Under Review/Approved/Partially
// Completed/Completed are deferred).
export const MOVEMENT_STATUSES = ["DRAFT", "POSTED", "CANCELLED", "REVERSED"] as const;
