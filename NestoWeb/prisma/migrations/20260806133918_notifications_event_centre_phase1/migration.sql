-- CreateTable
CREATE TABLE "EventCatalogueEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventCatalogueEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationPolicy_tenantId_eventKey_fkey" FOREIGN KEY ("tenantId", "eventKey") REFERENCES "EventCatalogueEntry" ("tenantId", "key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventCatalogueEntry_tenantId_module_idx" ON "EventCatalogueEntry"("tenantId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "EventCatalogueEntry_tenantId_key_key" ON "EventCatalogueEntry"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPolicy_tenantId_eventKey_key" ON "NotificationPolicy"("tenantId", "eventKey");
