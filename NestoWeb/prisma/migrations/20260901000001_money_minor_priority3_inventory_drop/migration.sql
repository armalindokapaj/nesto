-- Phase 15, step two — drop the float column now the minor-unit column is
-- populated.

ALTER TABLE "MovementLine" DROP COLUMN "unitCost";
