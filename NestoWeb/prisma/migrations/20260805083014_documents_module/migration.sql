-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "folderType" TEXT NOT NULL DEFAULT 'CUSTOM',
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "name" TEXT NOT NULL,
    "systemKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Folder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "docType" TEXT NOT NULL DEFAULT 'GENERAL',
    "category" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "primaryFolderId" TEXT,
    "ownerId" TEXT,
    "currentRevisionId" TEXT,
    "confidentiality" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredReading" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "retentionCategory" TEXT,
    "retentionEndAt" DATETIME,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "watermarkState" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_primaryFolderId_fkey" FOREIGN KEY ("primaryFolderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "DocumentFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentFolderRef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentFolderRef_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFolderRef_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relationType" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'DEPENDS_ON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentDependency_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentCollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "DocumentCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentCollectionItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentFavorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentReadReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME,
    "openedAt" DATETIME,
    "acknowledgedAt" DATETIME,
    CONSTRAINT "DocumentReadReceipt_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revisionId" TEXT,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentSavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'LIST',
    "filters" TEXT,
    "sort" TEXT,
    "columns" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSavedView_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "documentId" TEXT,
    "revisionCode" TEXT,
    CONSTRAINT "DocumentFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectApprovalId_fkey" FOREIGN KEY ("projectApprovalId") REFERENCES "ProjectApproval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "DocumentFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentFile" ("approvedAt", "approvedById", "category", "checksum", "clientId", "createdAt", "employeeId", "fileData", "fileMimeType", "fileSize", "id", "name", "projectApprovalId", "projectId", "revisionComment", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "unitId", "uploadedById", "uploaderSnapshot", "version", "visibility") SELECT "approvedAt", "approvedById", "category", "checksum", "clientId", "createdAt", "employeeId", "fileData", "fileMimeType", "fileSize", "id", "name", "projectApprovalId", "projectId", "revisionComment", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "unitId", "uploadedById", "uploaderSnapshot", "version", "visibility" FROM "DocumentFile";
DROP TABLE "DocumentFile";
ALTER TABLE "new_DocumentFile" RENAME TO "DocumentFile";
CREATE UNIQUE INDEX "DocumentFile_supersedesId_key" ON "DocumentFile"("supersedesId");
CREATE INDEX "DocumentFile_tenantId_projectId_idx" ON "DocumentFile"("tenantId", "projectId");
CREATE INDEX "DocumentFile_tenantId_taskId_idx" ON "DocumentFile"("tenantId", "taskId");
CREATE INDEX "DocumentFile_tenantId_clientId_idx" ON "DocumentFile"("tenantId", "clientId");
CREATE INDEX "DocumentFile_tenantId_unitId_idx" ON "DocumentFile"("tenantId", "unitId");
CREATE INDEX "DocumentFile_tenantId_documentId_idx" ON "DocumentFile"("tenantId", "documentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Folder_tenantId_parentId_idx" ON "Folder"("tenantId", "parentId");

-- CreateIndex
CREATE INDEX "Folder_tenantId_folderType_idx" ON "Folder"("tenantId", "folderType");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_tenantId_systemKey_key" ON "Folder"("tenantId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_currentRevisionId_key" ON "Document"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Document_tenantId_status_idx" ON "Document"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Document_tenantId_primaryFolderId_idx" ON "Document"("tenantId", "primaryFolderId");

-- CreateIndex
CREATE INDEX "Document_tenantId_archivedAt_idx" ON "Document"("tenantId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_tenantId_code_key" ON "Document"("tenantId", "code");

-- CreateIndex
CREATE INDEX "DocumentFolderRef_tenantId_folderId_idx" ON "DocumentFolderRef"("tenantId", "folderId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolderRef_documentId_folderId_key" ON "DocumentFolderRef"("documentId", "folderId");

-- CreateIndex
CREATE INDEX "DocumentLink_tenantId_entityType_entityId_idx" ON "DocumentLink"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_entityType_entityId_key" ON "DocumentLink"("documentId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "DocumentComment_tenantId_documentId_idx" ON "DocumentComment"("tenantId", "documentId");

-- CreateIndex
CREATE INDEX "DocumentDependency_tenantId_dependsOnId_idx" ON "DocumentDependency"("tenantId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDependency_documentId_dependsOnId_key" ON "DocumentDependency"("documentId", "dependsOnId");

-- CreateIndex
CREATE INDEX "DocumentCollection_tenantId_idx" ON "DocumentCollection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCollectionItem_collectionId_documentId_key" ON "DocumentCollectionItem"("collectionId", "documentId");

-- CreateIndex
CREATE INDEX "DocumentFavorite_tenantId_userId_idx" ON "DocumentFavorite"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFavorite_documentId_userId_key" ON "DocumentFavorite"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentReadReceipt_tenantId_userId_idx" ON "DocumentReadReceipt"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentReadReceipt_documentId_userId_key" ON "DocumentReadReceipt"("documentId", "userId");

-- CreateIndex
CREATE INDEX "DocumentActivity_tenantId_documentId_createdAt_idx" ON "DocumentActivity"("tenantId", "documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentSavedView_tenantId_userId_idx" ON "DocumentSavedView"("tenantId", "userId");
