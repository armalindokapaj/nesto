-- CreateTable
CREATE TABLE "RecordDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecordDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordDraft_tenantId_userId_formKey_key" ON "RecordDraft"("tenantId", "userId", "formKey");
