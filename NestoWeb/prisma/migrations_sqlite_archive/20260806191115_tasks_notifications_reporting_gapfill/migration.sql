-- CreateTable
CREATE TABLE "TaskWatcher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskWatcher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskWatcher_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relationType" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskRecurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" DATETIME NOT NULL,
    "lastGeneratedAt" DATETIME,
    "lastGeneratedTaskId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskRecurrence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskRecurrence_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskSavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "filtersJson" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskSavedView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationQuietHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startTime" TEXT NOT NULL DEFAULT '22:00',
    "endTime" TEXT NOT NULL DEFAULT '07:00',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationQuietHours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DigestRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'OFF',
    "timeOfDay" TEXT NOT NULL DEFAULT '08:00',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DigestRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL',
    "audienceValue" TEXT,
    "mandatoryAck" BOOLEAN NOT NULL DEFAULT false,
    "publishedById" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnnouncementAck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementAck_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "activatedById" TEXT NOT NULL,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    CONSTRAINT "EmergencyAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationDeliveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIMULATED',
    "subject" TEXT,
    "redactedPreview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "asOf" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" TEXT NOT NULL,
    CONSTRAINT "CurrencyRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReportExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "reportDefinitionId" TEXT NOT NULL,
    "executedById" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultJson" TEXT,
    "issued" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" DATETIME,
    "issuedById" TEXT,
    CONSTRAINT "ReportExecution_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportExecution_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportExecution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ReportExecution" ("executedAt", "executedById", "id", "reportDefinitionId", "rowCount", "tenantId") SELECT "executedAt", "executedById", "id", "reportDefinitionId", "rowCount", "tenantId" FROM "ReportExecution";
DROP TABLE "ReportExecution";
ALTER TABLE "new_ReportExecution" RENAME TO "ReportExecution";
CREATE INDEX "ReportExecution_tenantId_reportDefinitionId_idx" ON "ReportExecution"("tenantId", "reportDefinitionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaskWatcher_tenantId_userId_idx" ON "TaskWatcher"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskWatcher_taskId_userId_key" ON "TaskWatcher"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskLink_tenantId_taskId_idx" ON "TaskLink"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "TaskLink_tenantId_entityType_entityId_idx" ON "TaskLink"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskRecurrence_templateTaskId_key" ON "TaskRecurrence"("templateTaskId");

-- CreateIndex
CREATE INDEX "TaskRecurrence_tenantId_active_nextRunAt_idx" ON "TaskRecurrence"("tenantId", "active", "nextRunAt");

-- CreateIndex
CREATE INDEX "TaskSavedView_tenantId_userId_idx" ON "TaskSavedView"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationQuietHours_userId_key" ON "NotificationQuietHours"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DigestRule_userId_key" ON "DigestRule"("userId");

-- CreateIndex
CREATE INDEX "Announcement_tenantId_publishedAt_idx" ON "Announcement"("tenantId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementAck_announcementId_userId_key" ON "AnnouncementAck"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "EmergencyAlert_tenantId_resolvedAt_idx" ON "EmergencyAlert"("tenantId", "resolvedAt");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_tenantId_recipientUserId_idx" ON "NotificationDeliveryLog"("tenantId", "recipientUserId");

-- CreateIndex
CREATE INDEX "CurrencyRate_tenantId_fromCurrency_toCurrency_idx" ON "CurrencyRate"("tenantId", "fromCurrency", "toCurrency");
