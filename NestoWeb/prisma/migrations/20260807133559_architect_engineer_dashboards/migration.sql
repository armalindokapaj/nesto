-- CreateTable
CREATE TABLE "DrawingRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "drawingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fileDataUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingRevision_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrawingRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submittal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "description" TEXT,
    "fileDataUrl" TEXT,
    "submitterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" DATETIME,
    "decidedAt" DATETIME,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submittal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submittal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submittal_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submittal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngineeringPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" DATETIME,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngineeringPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EngineeringPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EngineeringPackage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packageId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "category" TEXT,
    "scope" TEXT,
    "currentRevision" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "fileDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Specification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Specification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Specification_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EngineeringPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Specification_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packageId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "type" TEXT,
    "technicalScope" TEXT,
    "assumptions" TEXT,
    "revision" TEXT NOT NULL DEFAULT 'A',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT,
    "checkerId" TEXT,
    "fileDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Calculation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Calculation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Calculation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "EngineeringPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Calculation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Calculation_checkerId_fkey" FOREIGN KEY ("checkerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workPackage" TEXT,
    "discipline" TEXT,
    "inspectionType" TEXT,
    "location" TEXT,
    "quantity" TEXT,
    "requestedDate" DATETIME,
    "plannedDate" DATETIME,
    "requesterId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "result" TEXT,
    "resultAt" DATETIME,
    "resultById" TEXT,
    "evidenceNotes" TEXT,
    "correctiveTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InspectionRequest_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionRequest_resultById_fkey" FOREIGN KEY ("resultById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoordinationIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bimModelId" TEXT,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "viewpointRef" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "linkedTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoordinationIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoordinationIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoordinationIssue_bimModelId_fkey" FOREIGN KEY ("bimModelId") REFERENCES "BimModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoordinationIssue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoordinationIssue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "unitId" TEXT,
    "requestType" TEXT NOT NULL DEFAULT 'FLOOR_PLAN',
    "description" TEXT,
    "deliverablesNote" TEXT,
    "dueDate" DATETIME,
    "assignedArchitectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_assignedArchitectId_fkey" FOREIGN KEY ("assignedArchitectId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Drawing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "discipline" TEXT,
    "revisionCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "updatedAt" DATETIME NOT NULL,
    "drawingType" TEXT,
    "locationContext" TEXT,
    "authorId" TEXT,
    "fileDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Drawing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drawing_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Drawing" ("discipline", "id", "packageName", "projectId", "revisionCode", "status", "tenantId", "updatedAt") SELECT "discipline", "id", "packageName", "projectId", "revisionCode", "status", "tenantId", "updatedAt" FROM "Drawing";
DROP TABLE "Drawing";
ALTER TABLE "new_Drawing" RENAME TO "Drawing";
CREATE INDEX "Drawing_tenantId_projectId_idx" ON "Drawing"("tenantId", "projectId");
CREATE TABLE "new_RFI" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discipline" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "response" TEXT,
    "respondedById" TEXT,
    "respondedAt" DATETIME,
    CONSTRAINT "RFI_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RFI_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RFI_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RFI" ("assignedToId", "code", "createdAt", "dueDate", "id", "projectId", "status", "tenantId", "title") SELECT "assignedToId", "code", "createdAt", "dueDate", "id", "projectId", "status", "tenantId", "title" FROM "RFI";
DROP TABLE "RFI";
ALTER TABLE "new_RFI" RENAME TO "RFI";
CREATE INDEX "RFI_tenantId_projectId_idx" ON "RFI"("tenantId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DrawingRevision_tenantId_drawingId_idx" ON "DrawingRevision"("tenantId", "drawingId");

-- CreateIndex
CREATE INDEX "Submittal_tenantId_projectId_idx" ON "Submittal"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Submittal_tenantId_status_idx" ON "Submittal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EngineeringPackage_tenantId_projectId_idx" ON "EngineeringPackage"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Specification_tenantId_projectId_idx" ON "Specification"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Calculation_tenantId_projectId_idx" ON "Calculation"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "InspectionRequest_tenantId_projectId_idx" ON "InspectionRequest"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "InspectionRequest_tenantId_status_idx" ON "InspectionRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CoordinationIssue_tenantId_projectId_idx" ON "CoordinationIssue"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "CoordinationIssue_tenantId_status_idx" ON "CoordinationIssue"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClientRequest_tenantId_projectId_idx" ON "ClientRequest"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ClientRequest_tenantId_status_idx" ON "ClientRequest"("tenantId", "status");
