-- CreateTable
CREATE TABLE "PlatformConfigSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "nodeKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformConfigSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformConfigSetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlatformConfigSetting_tenantId_companyId_idx" ON "PlatformConfigSetting"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConfigSetting_tenantId_companyId_nodeKey_key" ON "PlatformConfigSetting"("tenantId", "companyId", "nodeKey");
