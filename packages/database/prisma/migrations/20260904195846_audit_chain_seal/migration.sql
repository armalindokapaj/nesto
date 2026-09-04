/*
  Warnings:

  - You are about to drop the column `previousHash` on the `audit_event` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "integration"."search_document_title_idx";

-- AlterTable
ALTER TABLE "audit"."audit_event" DROP COLUMN "previousHash",
ADD COLUMN     "sealId" UUID;

-- CreateTable
CREATE TABLE "audit"."audit_chain_seal" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "fromAuditId" UUID NOT NULL,
    "toAuditId" UUID NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "rollingHash" TEXT NOT NULL,
    "previousSealHash" TEXT,
    "sealedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_chain_seal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_chain_seal_tenantId_sealedAt_idx" ON "audit"."audit_chain_seal"("tenantId", "sealedAt" DESC);

-- CreateIndex
CREATE INDEX "audit_event_tenantId_id_idx" ON "audit"."audit_event"("tenantId", "id");

-- CreateIndex
CREATE INDEX "audit_event_sealId_idx" ON "audit"."audit_event"("sealId");

-- CreateIndex
CREATE INDEX "search_document_title_idx" ON "integration"."search_document" USING GIN ("title" public.gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "audit"."audit_event" ADD CONSTRAINT "audit_event_sealId_fkey" FOREIGN KEY ("sealId") REFERENCES "audit"."audit_chain_seal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Append-only, refined (ADR-0008)
-- ---------------------------------------------------------------------------
-- `sealId` is the single column the sealing job stamps after the fact, so this
-- is the one column-level UPDATE grant on the audit table. Everything else
-- stays unwritable: an attempt to change an action, an actor or a hash fails at
-- the database, not at a service check.
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM nesto_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM nesto_audit;
GRANT SELECT, INSERT ON audit.audit_event TO nesto_app, nesto_audit;
GRANT UPDATE ("sealId") ON audit.audit_event TO nesto_app, nesto_audit;

-- Seals are themselves append-only: a seal that could be rewritten proves
-- nothing about the events it covers.
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_chain_seal FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_chain_seal FROM nesto_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_chain_seal FROM nesto_audit;
GRANT SELECT, INSERT ON audit.audit_chain_seal TO nesto_app, nesto_audit;

ALTER TABLE audit.audit_chain_seal ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_chain_seal FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit.audit_chain_seal;
CREATE POLICY tenant_isolation ON audit.audit_chain_seal
  USING (
    ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
    OR ("tenantId" IS NULL AND public.nesto_is_platform())
  )
  WITH CHECK (
    ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
    OR ("tenantId" IS NULL AND public.nesto_is_platform())
  );
