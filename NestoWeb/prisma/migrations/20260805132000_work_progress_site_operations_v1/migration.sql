-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discipline" TEXT NOT NULL,
    "location" TEXT,
    "contractorName" TEXT,
    "accountableOwnerId" TEXT NOT NULL,
    "measurementMethod" TEXT NOT NULL DEFAULT 'INSTALLED_QUANTITY',
    "unit" TEXT NOT NULL DEFAULT 'item',
    "approvedQuantity" REAL NOT NULL DEFAULT 0,
    "acceptedQuantity" REAL NOT NULL DEFAULT 0,
    "weight" REAL NOT NULL DEFAULT 0,
    "plannedStart" DATETIME,
    "plannedFinish" DATETIME,
    "forecastFinish" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "readinessStatus" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "qualityGateStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "hseGateStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "WorkPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPackage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkScheduleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL DEFAULT 'WORKING',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dataDate" DATETIME NOT NULL,
    "baselineAt" DATETIME,
    "checksum" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkScheduleVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkScheduleActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStart" DATETIME NOT NULL,
    "plannedFinish" DATETIME NOT NULL,
    "forecastFinish" DATETIME,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "progressPct" REAL NOT NULL DEFAULT 0,
    "dependencyType" TEXT,
    "predecessorCode" TEXT,
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "totalFloatDays" INTEGER,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkScheduleActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleActivity_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "WorkScheduleVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkScheduleActivity_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkProgressUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "baselineId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "updateNumber" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "periodQuantity" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "effectiveAt" DATETIME NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "verifiedAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "reversalOfId" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkProgressUpdate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressUpdate_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressUpdate_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "WorkScheduleVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySiteReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'DAY',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "weather" TEXT,
    "siteConditions" TEXT,
    "workforceJson" TEXT,
    "equipmentJson" TEXT,
    "workCompleted" TEXT,
    "deliveriesJson" TEXT,
    "materialsJson" TEXT,
    "issues" TEXT,
    "qualityNotes" TEXT,
    "hseNotes" TEXT,
    "visitors" TEXT,
    "nextShiftPlan" TEXT,
    "accountableOwnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "verifiedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySiteReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailySiteReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "impact" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "requiredBy" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "releasedAt" DATETIME,
    "releaseEvidence" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkConstraint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkConstraint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkConstraint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkConstraint_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkDelayEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "observedFact" TEXT NOT NULL,
    "allegedResponsibility" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "impactDays" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "mitigation" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkDelayEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkDelayEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkDelayEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkDelayEvent_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkProgressEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "progressUpdateId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PHOTO',
    "title" TEXT NOT NULL,
    "documentId" TEXT,
    "documentRevisionId" TEXT,
    "url" TEXT,
    "location" TEXT,
    "capturedAt" DATETIME NOT NULL,
    "checksum" TEXT,
    "annotationJson" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'PROJECT',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkProgressEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressEvidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressEvidence_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkProgressEvidence_progressUpdateId_fkey" FOREIGN KEY ("progressUpdateId") REFERENCES "WorkProgressUpdate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkMeasurementSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "contractorName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "claimedValue" REAL NOT NULL DEFAULT 0,
    "measuredValue" REAL NOT NULL DEFAULT 0,
    "acceptedValue" REAL NOT NULL DEFAULT 0,
    "certifiedValue" REAL NOT NULL DEFAULT 0,
    "differenceReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkMeasurementSheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkMeasurementSheet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkMeasurementSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkMeasurementLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "claimedQuantity" REAL NOT NULL DEFAULT 0,
    "measuredQuantity" REAL NOT NULL DEFAULT 0,
    "acceptedQuantity" REAL NOT NULL DEFAULT 0,
    "certifiedQuantity" REAL NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    CONSTRAINT "WorkMeasurementLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "WorkMeasurementSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkMeasurementLine_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkProgressActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "nextStatus" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkProgressActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkPackage_tenantId_projectId_status_idx" ON "WorkPackage"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPackage_tenantId_projectId_code_key" ON "WorkPackage"("tenantId", "projectId", "code");

-- CreateIndex
CREATE INDEX "WorkScheduleVersion_tenantId_status_idx" ON "WorkScheduleVersion"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleVersion_projectId_version_key" ON "WorkScheduleVersion"("projectId", "version");

-- CreateIndex
CREATE INDEX "WorkScheduleActivity_tenantId_projectId_status_idx" ON "WorkScheduleActivity"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkScheduleActivity_scheduleVersionId_code_key" ON "WorkScheduleActivity"("scheduleVersionId", "code");

-- CreateIndex
CREATE INDEX "WorkProgressUpdate_tenantId_projectId_status_idx" ON "WorkProgressUpdate"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkProgressUpdate_tenantId_idempotencyKey_key" ON "WorkProgressUpdate"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkProgressUpdate_tenantId_updateNumber_key" ON "WorkProgressUpdate"("tenantId", "updateNumber");

-- CreateIndex
CREATE INDEX "DailySiteReport_tenantId_status_reportDate_idx" ON "DailySiteReport"("tenantId", "status", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySiteReport_projectId_reportDate_shift_revision_key" ON "DailySiteReport"("projectId", "reportDate", "shift", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "DailySiteReport_tenantId_reportNumber_key" ON "DailySiteReport"("tenantId", "reportNumber");

-- CreateIndex
CREATE INDEX "WorkConstraint_tenantId_projectId_status_idx" ON "WorkConstraint"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkConstraint_tenantId_number_key" ON "WorkConstraint"("tenantId", "number");

-- CreateIndex
CREATE INDEX "WorkDelayEvent_tenantId_projectId_status_idx" ON "WorkDelayEvent"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDelayEvent_tenantId_number_key" ON "WorkDelayEvent"("tenantId", "number");

-- CreateIndex
CREATE INDEX "WorkProgressEvidence_tenantId_projectId_capturedAt_idx" ON "WorkProgressEvidence"("tenantId", "projectId", "capturedAt");

-- CreateIndex
CREATE INDEX "WorkMeasurementSheet_tenantId_projectId_status_idx" ON "WorkMeasurementSheet"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkMeasurementSheet_tenantId_number_key" ON "WorkMeasurementSheet"("tenantId", "number");

-- CreateIndex
CREATE INDEX "WorkProgressActivity_tenantId_entityType_entityId_idx" ON "WorkProgressActivity"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "WorkProgressActivity_tenantId_createdAt_idx" ON "WorkProgressActivity"("tenantId", "createdAt");
