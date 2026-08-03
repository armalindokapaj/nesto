-- AlterTable
ALTER TABLE "DocumentFile" ADD COLUMN "checksum" TEXT;
ALTER TABLE "DocumentFile" ADD COLUMN "fileData" BLOB;
ALTER TABLE "DocumentFile" ADD COLUMN "fileMimeType" TEXT;
ALTER TABLE "DocumentFile" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "DocumentFile" ADD COLUMN "revisionComment" TEXT;
ALTER TABLE "DocumentFile" ADD COLUMN "uploaderSnapshot" TEXT;

-- AlterTable
ALTER TABLE "DomainEvent" ADD COLUMN "actorSnapshot" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "causationId" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "confidentiality" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "owningCompanyId" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "projectId" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "sourceModule" TEXT;
ALTER TABLE "DomainEvent" ADD COLUMN "sourceRecordId" TEXT;

-- CreateTable
CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "documentFileId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approverSnapshot" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentApproval_documentFileId_fkey" FOREIGN KEY ("documentFileId") REFERENCES "DocumentFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentApproval_tenantId_documentFileId_idx" ON "DocumentApproval"("tenantId", "documentFileId");

-- CreateIndex
CREATE INDEX "DomainEvent_correlationId_idx" ON "DomainEvent"("correlationId");
