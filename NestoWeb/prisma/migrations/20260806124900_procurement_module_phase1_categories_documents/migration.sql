-- CreateTable
CREATE TABLE "SupplierCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SupplierCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "documentId" TEXT,
    "url" TEXT,
    "issuedAt" DATETIME,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "tradingName" TEXT,
    "supplierType" TEXT NOT NULL DEFAULT 'MATERIALS',
    "category" TEXT NOT NULL,
    "categoryId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "registrationId" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'AL',
    "address" TEXT,
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "qualificationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "overallScore" REAL,
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Supplier_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SupplierCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Supplier" ("address", "archivedAt", "category", "companyId", "countryCode", "createdAt", "currency", "email", "id", "leadTimeDays", "legalName", "name", "notes", "number", "overallScore", "paymentTerms", "phone", "qualificationStatus", "registrationId", "status", "supplierType", "taxId", "tenantId", "tradingName", "updatedAt", "version", "website") SELECT "address", "archivedAt", "category", "companyId", "countryCode", "createdAt", "currency", "email", "id", "leadTimeDays", "legalName", "name", "notes", "number", "overallScore", "paymentTerms", "phone", "qualificationStatus", "registrationId", "status", "supplierType", "taxId", "tenantId", "tradingName", "updatedAt", "version", "website" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE INDEX "Supplier_tenantId_status_idx" ON "Supplier"("tenantId", "status");
CREATE INDEX "Supplier_tenantId_category_idx" ON "Supplier"("tenantId", "category");
CREATE UNIQUE INDEX "Supplier_tenantId_number_key" ON "Supplier"("tenantId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SupplierCategory_tenantId_active_idx" ON "SupplierCategory"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCategory_tenantId_code_key" ON "SupplierCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "SupplierDocument_tenantId_supplierId_idx" ON "SupplierDocument"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "SupplierDocument_tenantId_expiresAt_idx" ON "SupplierDocument"("tenantId", "expiresAt");
