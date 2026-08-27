-- Phase 15 — Priority 2 money fields to integer minor units, same recipe as
-- Phase 14: add and backfill here, drop in the next migration, so a bad
-- backfill is catchable while the source values still exist.
--
-- quantity / deliveredQuantity / acceptedQuantity / rejectedQuantity are NOT
-- money and are deliberately untouched: they are measured amounts that may
-- legitimately be fractional.

ALTER TABLE "Contract" ADD COLUMN "valueMinor" INTEGER;
UPDATE "Contract" SET "valueMinor" = ROUND("value"::numeric * 100);
ALTER TABLE "Contract" ALTER COLUMN "valueMinor" SET NOT NULL;
ALTER TABLE "SpendingBill" ADD COLUMN "amountMinor" INTEGER;
UPDATE "SpendingBill" SET "amountMinor" = ROUND("amount"::numeric * 100);
ALTER TABLE "SpendingBill" ALTER COLUMN "amountMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "amountMinor" INTEGER;
UPDATE "PurchaseOrder" SET "amountMinor" = ROUND("amount"::numeric * 100);
ALTER TABLE "PurchaseOrder" ALTER COLUMN "amountMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "subtotalMinor" INTEGER;
UPDATE "PurchaseOrder" SET "subtotalMinor" = ROUND("subtotal"::numeric * 100);
ALTER TABLE "PurchaseOrder" ALTER COLUMN "subtotalMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "discountMinor" INTEGER;
UPDATE "PurchaseOrder" SET "discountMinor" = ROUND("discount"::numeric * 100);
ALTER TABLE "PurchaseOrder" ALTER COLUMN "discountMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "taxMinor" INTEGER;
UPDATE "PurchaseOrder" SET "taxMinor" = ROUND("tax"::numeric * 100);
ALTER TABLE "PurchaseOrder" ALTER COLUMN "taxMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ADD COLUMN "freightMinor" INTEGER;
UPDATE "PurchaseOrder" SET "freightMinor" = ROUND("freight"::numeric * 100);
ALTER TABLE "PurchaseOrder" ALTER COLUMN "freightMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "unitPriceMinor" INTEGER;
UPDATE "PurchaseOrderLine" SET "unitPriceMinor" = ROUND("unitPrice"::numeric * 100);
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "unitPriceMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "discountMinor" INTEGER;
UPDATE "PurchaseOrderLine" SET "discountMinor" = ROUND("discount"::numeric * 100);
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "discountMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "taxMinor" INTEGER;
UPDATE "PurchaseOrderLine" SET "taxMinor" = ROUND("tax"::numeric * 100);
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "taxMinor" SET NOT NULL;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN "lineTotalMinor" INTEGER;
UPDATE "PurchaseOrderLine" SET "lineTotalMinor" = ROUND("lineTotal"::numeric * 100);
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "lineTotalMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotation" ADD COLUMN "subtotalMinor" INTEGER;
UPDATE "SupplierQuotation" SET "subtotalMinor" = ROUND("subtotal"::numeric * 100);
ALTER TABLE "SupplierQuotation" ALTER COLUMN "subtotalMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotation" ADD COLUMN "discountMinor" INTEGER;
UPDATE "SupplierQuotation" SET "discountMinor" = ROUND("discount"::numeric * 100);
ALTER TABLE "SupplierQuotation" ALTER COLUMN "discountMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotation" ADD COLUMN "taxMinor" INTEGER;
UPDATE "SupplierQuotation" SET "taxMinor" = ROUND("tax"::numeric * 100);
ALTER TABLE "SupplierQuotation" ALTER COLUMN "taxMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotation" ADD COLUMN "freightMinor" INTEGER;
UPDATE "SupplierQuotation" SET "freightMinor" = ROUND("freight"::numeric * 100);
ALTER TABLE "SupplierQuotation" ALTER COLUMN "freightMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotation" ADD COLUMN "totalMinor" INTEGER;
UPDATE "SupplierQuotation" SET "totalMinor" = ROUND("total"::numeric * 100);
ALTER TABLE "SupplierQuotation" ALTER COLUMN "totalMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotationLine" ADD COLUMN "unitPriceMinor" INTEGER;
UPDATE "SupplierQuotationLine" SET "unitPriceMinor" = ROUND("unitPrice"::numeric * 100);
ALTER TABLE "SupplierQuotationLine" ALTER COLUMN "unitPriceMinor" SET NOT NULL;
ALTER TABLE "SupplierQuotationLine" ADD COLUMN "lineTotalMinor" INTEGER;
UPDATE "SupplierQuotationLine" SET "lineTotalMinor" = ROUND("lineTotal"::numeric * 100);
ALTER TABLE "SupplierQuotationLine" ALTER COLUMN "lineTotalMinor" SET NOT NULL;
