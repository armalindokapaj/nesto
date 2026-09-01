-- Phase 15 — Priority 3, inventory half. Same add-and-backfill-then-drop
-- recipe as Priority 1/2 so a bad backfill is catchable while the source
-- values still exist.
--
-- unitCost stays NULLABLE, unlike the Priority 2 columns: a receiving line
-- legitimately has no cost entered, and the valuation page depends on that
-- distinction to show "—" instead of fabricating a zero cost.
--
-- qty is NOT money and is deliberately untouched — it is a measured quantity
-- that may legitimately be fractional.

ALTER TABLE "MovementLine" ADD COLUMN "unitCostMinor" INTEGER;
UPDATE "MovementLine" SET "unitCostMinor" = ROUND("unitCost"::numeric * 100) WHERE "unitCost" IS NOT NULL;
