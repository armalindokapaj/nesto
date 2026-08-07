-- CreateTable
CREATE TABLE "LegalCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "projectId" TEXT,
    "counterparty" TEXT,
    "summary" TEXT,
    "confidentialityTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "openedById" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "LegalCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalCaseAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "LegalCaseAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegalCaseAccess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT,
    "scope" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "placedById" TEXT NOT NULL,
    "placedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" DATETIME,
    CONSTRAINT "LegalHold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegalHold_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LegalCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LegalCase_tenantId_status_idx" ON "LegalCase"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCase_tenantId_caseNumber_key" ON "LegalCase"("tenantId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LegalCaseAccess_caseId_userId_key" ON "LegalCaseAccess"("caseId", "userId");

-- CreateIndex
CREATE INDEX "LegalHold_tenantId_status_idx" ON "LegalHold"("tenantId", "status");
