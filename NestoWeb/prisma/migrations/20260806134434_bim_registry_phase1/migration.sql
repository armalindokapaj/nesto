-- CreateTable
CREATE TABLE "BimModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL DEFAULT 'ARCHITECTURAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BimModel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BimModelVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "documentId" TEXT,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BimModelVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BimModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "BimModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BimModelVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BimObjectLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "objectRef" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'RELATES_TO',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BimObjectLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BimObjectLink_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "BimModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BimObjectLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BimModel_tenantId_projectId_idx" ON "BimModel"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BimModelVersion_modelId_versionNumber_key" ON "BimModelVersion"("modelId", "versionNumber");

-- CreateIndex
CREATE INDEX "BimObjectLink_tenantId_modelId_idx" ON "BimObjectLink"("tenantId", "modelId");

-- CreateIndex
CREATE INDEX "BimObjectLink_tenantId_entityType_entityId_idx" ON "BimObjectLink"("tenantId", "entityType", "entityId");
