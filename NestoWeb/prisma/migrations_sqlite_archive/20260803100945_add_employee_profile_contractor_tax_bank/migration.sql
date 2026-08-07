-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "taxId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "phone" TEXT;
ALTER TABLE "Employee" ADD COLUMN "photoDataUrl" TEXT;

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
    CONSTRAINT "DocumentFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "DocumentFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentFile" ("approvedAt", "approvedById", "category", "clientId", "createdAt", "id", "name", "projectId", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "uploadedById", "version") SELECT "approvedAt", "approvedById", "category", "clientId", "createdAt", "id", "name", "projectId", "status", "supersedesId", "taskDepartmentId", "taskId", "taskStageId", "tenantId", "uploadedById", "version" FROM "DocumentFile";
DROP TABLE "DocumentFile";
ALTER TABLE "new_DocumentFile" RENAME TO "DocumentFile";
CREATE UNIQUE INDEX "DocumentFile_supersedesId_key" ON "DocumentFile"("supersedesId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
