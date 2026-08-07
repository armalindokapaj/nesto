-- CreateTable
CREATE TABLE "HseInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SITE_SAFETY',
    "location" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'PENDING',
    "findings" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'UNSAFE_ACT',
    "description" TEXT NOT NULL,
    "location" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionTaken" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseObservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseObservation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'NEAR_MISS',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "location" TEXT,
    "injuredPersonRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "rootCause" TEXT,
    "closedAt" DATETIME,
    "reportedById" TEXT NOT NULL,
    "investigatorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HseIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HseIncident_investigatorId_fkey" FOREIGN KEY ("investigatorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseCorrectiveAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT,
    "inspectionId" TEXT,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" DATETIME,
    "ownerId" TEXT NOT NULL,
    "verifiedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseCorrectiveAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseCorrectiveAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "HseIncident" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseCorrectiveAction_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "HseInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseCorrectiveAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HseCorrectiveAction_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseInduction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "workerCompany" TEXT,
    "topicsCovered" TEXT,
    "conductedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "conductedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseInduction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseInduction_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseToolboxTalk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "notes" TEXT,
    "attendeeCount" INTEGER NOT NULL DEFAULT 0,
    "conductedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conductedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseToolboxTalk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseToolboxTalk_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseEmergencyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseEmergencyContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HseInspection_tenantId_projectId_idx" ON "HseInspection"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "HseInspection_tenantId_status_idx" ON "HseInspection"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HseInspection_tenantId_number_key" ON "HseInspection"("tenantId", "number");

-- CreateIndex
CREATE INDEX "HseObservation_tenantId_projectId_idx" ON "HseObservation"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "HseObservation_tenantId_status_idx" ON "HseObservation"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HseObservation_tenantId_number_key" ON "HseObservation"("tenantId", "number");

-- CreateIndex
CREATE INDEX "HseIncident_tenantId_projectId_idx" ON "HseIncident"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "HseIncident_tenantId_status_idx" ON "HseIncident"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HseIncident_tenantId_number_key" ON "HseIncident"("tenantId", "number");

-- CreateIndex
CREATE INDEX "HseCorrectiveAction_tenantId_status_idx" ON "HseCorrectiveAction"("tenantId", "status");

-- CreateIndex
CREATE INDEX "HseInduction_tenantId_projectId_idx" ON "HseInduction"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "HseToolboxTalk_tenantId_projectId_idx" ON "HseToolboxTalk"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "HseEmergencyContact_tenantId_projectId_idx" ON "HseEmergencyContact"("tenantId", "projectId");
