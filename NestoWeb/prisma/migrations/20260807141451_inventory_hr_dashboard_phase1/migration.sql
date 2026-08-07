-- AlterTable
ALTER TABLE "MovementLine" ADD COLUMN "expiryDate" DATETIME;

-- AlterTable
ALTER TABLE "StockBalance" ADD COLUMN "reorderPoint" REAL;
ALTER TABLE "StockBalance" ADD COLUMN "reorderQty" REAL;

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "projectId" TEXT,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME,
    "fulfilledMovementId" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_fulfilledMovementId_fkey" FOREIGN KEY ("fulfilledMovementId") REFERENCES "InventoryMovement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockReservation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CYCLE',
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" DATETIME,
    "startedAt" DATETIME,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "adjustmentMovementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryCount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryCount_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryCount_adjustmentMovementId_fkey" FOREIGN KEY ("adjustmentMovementId") REFERENCES "InventoryMovement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQty" REAL NOT NULL,
    "countedQty" REAL,
    "varianceReason" TEXT,
    "countedById" TEXT,
    "countedAt" DATETIME,
    CONSTRAINT "InventoryCountLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryCountLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "movementsCount" INTEGER NOT NULL DEFAULT 0,
    "discrepanciesCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyClose_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyClose_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyClose_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "weekStartDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalHours" REAL NOT NULL DEFAULT 0,
    "submittedAt" DATETIME,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "EmploymentRelationship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimesheetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "costCode" TEXT,
    "hours" REAL NOT NULL,
    "description" TEXT,
    CONSTRAINT "TimesheetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimesheetLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimesheetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "sourceModule" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedAt" DATETIME,
    "postedById" TEXT,
    "reversesMovementId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    "recipientId" TEXT,
    "confirmationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "confirmedAt" DATETIME,
    "confirmedById" TEXT,
    "disputeReason" TEXT,
    CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_reversesMovementId_fkey" FOREIGN KEY ("reversesMovementId") REFERENCES "InventoryMovement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryMovement" ("createdAt", "createdById", "date", "id", "number", "postedAt", "postedById", "reason", "reversesMovementId", "sourceId", "sourceModule", "status", "tenantId", "type") SELECT "createdAt", "createdById", "date", "id", "number", "postedAt", "postedById", "reason", "reversesMovementId", "sourceId", "sourceModule", "status", "tenantId", "type" FROM "InventoryMovement";
DROP TABLE "InventoryMovement";
ALTER TABLE "new_InventoryMovement" RENAME TO "InventoryMovement";
CREATE UNIQUE INDEX "InventoryMovement_reversesMovementId_key" ON "InventoryMovement"("reversesMovementId");
CREATE INDEX "InventoryMovement_tenantId_status_idx" ON "InventoryMovement"("tenantId", "status");
CREATE INDEX "InventoryMovement_tenantId_confirmationStatus_idx" ON "InventoryMovement"("tenantId", "confirmationStatus");
CREATE UNIQUE INDEX "InventoryMovement_tenantId_number_key" ON "InventoryMovement"("tenantId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StockReservation_tenantId_status_idx" ON "StockReservation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_tenantId_productId_warehouseId_idx" ON "StockReservation"("tenantId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryCount_tenantId_status_idx" ON "InventoryCount"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryCount_tenantId_warehouseId_idx" ON "InventoryCount"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryCountLine_tenantId_countId_idx" ON "InventoryCountLine"("tenantId", "countId");

-- CreateIndex
CREATE INDEX "DailyClose_tenantId_status_idx" ON "DailyClose"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClose_warehouseId_workDate_key" ON "DailyClose"("warehouseId", "workDate");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_status_idx" ON "Timesheet"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_employmentId_weekStartDate_key" ON "Timesheet"("employmentId", "weekStartDate");

-- CreateIndex
CREATE INDEX "TimesheetLine_tenantId_timesheetId_idx" ON "TimesheetLine"("tenantId", "timesheetId");

-- CreateIndex
CREATE INDEX "TimesheetLine_tenantId_projectId_idx" ON "TimesheetLine"("tenantId", "projectId");
