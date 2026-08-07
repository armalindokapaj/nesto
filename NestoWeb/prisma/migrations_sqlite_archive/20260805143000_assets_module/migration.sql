-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "depreciationMethod" TEXT,
    "usefulLifeMonths" INTEGER,
    "inspectionIntervalDays" INTEGER,
    "maintenanceIntervalDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assigneeType" TEXT NOT NULL,
    "assigneeId" TEXT,
    "assigneeName" TEXT NOT NULL,
    "projectId" TEXT,
    "location" TEXT,
    "assignedAt" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "conditionOut" TEXT,
    "conditionIn" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationId" TEXT,
    "locationName" TEXT NOT NULL,
    "effectiveAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetLocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recurrenceRule" TEXT,
    "meterInterval" REAL,
    "lastPerformedAt" DATETIME,
    "nextDueAt" DATETIME,
    "nextDueMeter" REAL,
    "assignedTechnicianId" TEXT,
    "estimatedCost" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetMaintenance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetWorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "maintenanceId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "slaDueAt" DATETIME,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "closedAt" DATETIME,
    "technicianId" TEXT,
    "technicianName" TEXT,
    "laborHours" REAL NOT NULL DEFAULT 0,
    "laborCost" REAL NOT NULL DEFAULT 0,
    "materialCost" REAL NOT NULL DEFAULT 0,
    "downtimeHours" REAL NOT NULL DEFAULT 0,
    "checklistJson" TEXT,
    "completionNotes" TEXT,
    "signatureName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetWorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetWorkOrder_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "AssetMaintenance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "inspectedAt" DATETIME,
    "inspectorId" TEXT,
    "inspectorName" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "checklistJson" TEXT,
    "findings" TEXT,
    "certificateDocumentId" TEXT,
    "nextDueAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetInspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetCalibration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "toleranceMin" REAL,
    "toleranceMax" REAL,
    "measuredValue" REAL,
    "calibratedAt" DATETIME,
    "nextDueAt" DATETIME NOT NULL,
    "provider" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "certificateDocumentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetCalibration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetCalibration_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetWarranty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT,
    "coverage" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetWarranty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetWarranty_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetInsurancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "insuredValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetInsurancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetInsurancePolicy_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "projectId" TEXT,
    "reservedForId" TEXT,
    "reservedForName" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetReservation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT,
    "toName" TEXT NOT NULL,
    "transferredAt" DATETIME NOT NULL,
    "condition" TEXT,
    "reason" TEXT NOT NULL,
    "receivedByName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetTransfer_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetDocumentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentRevisionId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetDocumentLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetDocumentLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "correlationId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetActivity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "categoryId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "ownershipCompanyId" TEXT,
    "ownershipCompanyName" TEXT,
    "department" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "registrationNumber" TEXT,
    "qrCode" TEXT,
    "barcode" TEXT,
    "rfidTag" TEXT,
    "specificationJson" TEXT,
    "purchaseDate" DATETIME,
    "purchaseValue" REAL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "depreciationMethod" TEXT,
    "usefulLifeMonths" INTEGER,
    "salvageValue" REAL,
    "bookValue" REAL,
    "disposalValue" REAL,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "currentLocation" TEXT,
    "custodianId" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "notes" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("createdAt", "updatedAt", "id", "name", "projectId", "purchaseValue", "bookValue", "status", "tenantId", "type") SELECT "createdAt", "createdAt", "id", "name", "projectId", "purchaseValue", "purchaseValue", CASE "status" WHEN 'AVAILABLE' THEN 'ACTIVE' WHEN 'IN_USE' THEN 'ASSIGNED' ELSE "status" END, "tenantId", "type" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_tenantId_status_type_idx" ON "Asset"("tenantId", "status", "type");
CREATE INDEX "Asset_tenantId_projectId_idx" ON "Asset"("tenantId", "projectId");
CREATE UNIQUE INDEX "Asset_tenantId_code_key" ON "Asset"("tenantId", "code");
CREATE UNIQUE INDEX "Asset_tenantId_qrCode_key" ON "Asset"("tenantId", "qrCode");
CREATE UNIQUE INDEX "Asset_tenantId_barcode_key" ON "Asset"("tenantId", "barcode");
CREATE UNIQUE INDEX "Asset_tenantId_rfidTag_key" ON "Asset"("tenantId", "rfidTag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_tenantId_code_key" ON "AssetCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AssetAssignment_tenantId_assetId_assignedAt_idx" ON "AssetAssignment"("tenantId", "assetId", "assignedAt");

-- CreateIndex
CREATE INDEX "AssetLocation_tenantId_assetId_effectiveAt_idx" ON "AssetLocation"("tenantId", "assetId", "effectiveAt");

-- CreateIndex
CREATE INDEX "AssetMaintenance_tenantId_nextDueAt_status_idx" ON "AssetMaintenance"("tenantId", "nextDueAt", "status");

-- CreateIndex
CREATE INDEX "AssetWorkOrder_tenantId_status_priority_idx" ON "AssetWorkOrder"("tenantId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AssetWorkOrder_tenantId_number_key" ON "AssetWorkOrder"("tenantId", "number");

-- CreateIndex
CREATE INDEX "AssetInspection_tenantId_result_nextDueAt_idx" ON "AssetInspection"("tenantId", "result", "nextDueAt");

-- CreateIndex
CREATE INDEX "AssetCalibration_tenantId_nextDueAt_result_idx" ON "AssetCalibration"("tenantId", "nextDueAt", "result");

-- CreateIndex
CREATE INDEX "AssetWarranty_tenantId_expiresAt_status_idx" ON "AssetWarranty"("tenantId", "expiresAt", "status");

-- CreateIndex
CREATE INDEX "AssetInsurancePolicy_tenantId_expiresAt_status_idx" ON "AssetInsurancePolicy"("tenantId", "expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetInsurancePolicy_tenantId_policyNumber_key" ON "AssetInsurancePolicy"("tenantId", "policyNumber");

-- CreateIndex
CREATE INDEX "AssetReservation_tenantId_assetId_startsAt_endsAt_idx" ON "AssetReservation"("tenantId", "assetId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AssetTransfer_tenantId_assetId_transferredAt_idx" ON "AssetTransfer"("tenantId", "assetId", "transferredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTransfer_tenantId_number_key" ON "AssetTransfer"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDocumentLink_assetId_documentId_documentRevisionId_key" ON "AssetDocumentLink"("assetId", "documentId", "documentRevisionId");

-- CreateIndex
CREATE INDEX "AssetActivity_tenantId_assetId_createdAt_idx" ON "AssetActivity"("tenantId", "assetId", "createdAt");
