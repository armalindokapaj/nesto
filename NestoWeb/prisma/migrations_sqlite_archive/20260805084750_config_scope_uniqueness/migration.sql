-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformConfigSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'TENANT',
    "nodeKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformConfigSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformConfigSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlatformConfigSetting" ("companyId", "enabled", "id", "nodeKey", "tenantId", "updatedAt", "updatedById") SELECT "companyId", "enabled", "id", "nodeKey", "tenantId", "updatedAt", "updatedById" FROM "PlatformConfigSetting";
DROP TABLE "PlatformConfigSetting";
ALTER TABLE "new_PlatformConfigSetting" RENAME TO "PlatformConfigSetting";
CREATE INDEX "PlatformConfigSetting_tenantId_companyId_idx" ON "PlatformConfigSetting"("tenantId", "companyId");
CREATE UNIQUE INDEX "PlatformConfigSetting_tenantId_scope_nodeKey_key" ON "PlatformConfigSetting"("tenantId", "scope", "nodeKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
