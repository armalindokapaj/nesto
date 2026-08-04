-- CreateTable
CREATE TABLE "ProjectStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BUILDING',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStructure_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectFloor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectFloor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectFloor_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "ProjectStructure" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "structureId" TEXT,
    "floorId" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayName" TEXT,
    "orientation" TEXT,
    "view" TEXT,
    "features" TEXT,
    "notes" TEXT,
    "constructionStatus" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "fixedAdjustment" REAL NOT NULL DEFAULT 0,
    "typeFields" TEXT,
    "pinnedRenderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Unit_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "ProjectStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "ProjectFloor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Unit_pinnedRenderId_fkey" FOREIGN KEY ("pinnedRenderId") REFERENCES "UnitRender" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitAreaComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "areaM2" REAL NOT NULL,
    "pricePerM2" REAL NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "includedInTotal" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UnitAreaComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitAreaComponent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitRender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "fileData" BLOB NOT NULL,
    "fileMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitRender_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitRender_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitRender_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitActivityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitActivityEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UnitActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "clientId" TEXT,
    "employeeId" TEXT,
    "projectApprovalId" TEXT,
    "unitId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'COMPANY',
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "taskStageId" TEXT,
    "taskDepartmentId" TEXT,
    "fileData" BLOB,
    "fileMimeType" TEXT,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "revisionComment" TEXT,
    "uploaderSnapshot" TEXT,
    CONSTRAINT "DocumentFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectApprovalId_fkey" FOREIGN KEY ("projectApprovalId") REFERENCES "ProjectApproval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "DocumentFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentFile" ("approvedAt", "approvedById", "category", "checksum", "clientId", "createdAt", "employeeId", "fileData", "fileMimeType", "fileSize", "id", "name", "projectApprovalId", "projectId", "revisionComment", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "uploadedById", "uploaderSnapshot", "version", "visibility") SELECT "approvedAt", "approvedById", "category", "checksum", "clientId", "createdAt", "employeeId", "fileData", "fileMimeType", "fileSize", "id", "name", "projectApprovalId", "projectId", "revisionComment", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "uploadedById", "uploaderSnapshot", "version", "visibility" FROM "DocumentFile";
DROP TABLE "DocumentFile";
ALTER TABLE "new_DocumentFile" RENAME TO "DocumentFile";
CREATE UNIQUE INDEX "DocumentFile_supersedesId_key" ON "DocumentFile"("supersedesId");
CREATE INDEX "DocumentFile_tenantId_projectId_idx" ON "DocumentFile"("tenantId", "projectId");
CREATE INDEX "DocumentFile_tenantId_taskId_idx" ON "DocumentFile"("tenantId", "taskId");
CREATE INDEX "DocumentFile_tenantId_clientId_idx" ON "DocumentFile"("tenantId", "clientId");
CREATE INDEX "DocumentFile_tenantId_unitId_idx" ON "DocumentFile"("tenantId", "unitId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectStructure_tenantId_projectId_idx" ON "ProjectStructure"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStructure_projectId_name_key" ON "ProjectStructure"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectFloor_tenantId_structureId_idx" ON "ProjectFloor"("tenantId", "structureId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFloor_structureId_label_key" ON "ProjectFloor"("structureId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_pinnedRenderId_key" ON "Unit"("pinnedRenderId");

-- CreateIndex
CREATE INDEX "Unit_tenantId_projectId_idx" ON "Unit"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Unit_tenantId_structureId_idx" ON "Unit"("tenantId", "structureId");

-- CreateIndex
CREATE INDEX "Unit_tenantId_floorId_idx" ON "Unit"("tenantId", "floorId");

-- CreateIndex
CREATE INDEX "Unit_tenantId_lifecycleStatus_idx" ON "Unit"("tenantId", "lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_projectId_code_key" ON "Unit"("projectId", "code");

-- CreateIndex
CREATE INDEX "UnitAreaComponent_tenantId_unitId_idx" ON "UnitAreaComponent"("tenantId", "unitId");

-- CreateIndex
CREATE INDEX "UnitRender_tenantId_unitId_idx" ON "UnitRender"("tenantId", "unitId");

-- CreateIndex
CREATE INDEX "UnitActivityEvent_tenantId_unitId_idx" ON "UnitActivityEvent"("tenantId", "unitId");
