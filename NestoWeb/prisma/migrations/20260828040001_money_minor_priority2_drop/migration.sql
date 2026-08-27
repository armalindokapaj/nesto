-- Phase 15, step two — drop the float columns now the minor-unit columns are
-- populated and NOT NULL.

ALTER TABLE "Contract" DROP COLUMN "value";
ALTER TABLE "SpendingBill" DROP COLUMN "amount";
ALTER TABLE "PurchaseOrder" DROP COLUMN "amount";
ALTER TABLE "PurchaseOrder" DROP COLUMN "subtotal";
ALTER TABLE "PurchaseOrder" DROP COLUMN "discount";
ALTER TABLE "PurchaseOrder" DROP COLUMN "tax";
ALTER TABLE "PurchaseOrder" DROP COLUMN "freight";
ALTER TABLE "PurchaseOrderLine" DROP COLUMN "unitPrice";
ALTER TABLE "PurchaseOrderLine" DROP COLUMN "discount";
ALTER TABLE "PurchaseOrderLine" DROP COLUMN "tax";
ALTER TABLE "PurchaseOrderLine" DROP COLUMN "lineTotal";
ALTER TABLE "SupplierQuotation" DROP COLUMN "subtotal";
ALTER TABLE "SupplierQuotation" DROP COLUMN "discount";
ALTER TABLE "SupplierQuotation" DROP COLUMN "tax";
ALTER TABLE "SupplierQuotation" DROP COLUMN "freight";
ALTER TABLE "SupplierQuotation" DROP COLUMN "total";
ALTER TABLE "SupplierQuotationLine" DROP COLUMN "unitPrice";
ALTER TABLE "SupplierQuotationLine" DROP COLUMN "lineTotal";
