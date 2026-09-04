-- Extensions first: the generated GIN index on search_document uses
-- public.gin_trgm_ops, so the operator class has to exist before Prisma's own
-- CreateIndex statements run. pg_trgm backs fuzzy search and autocomplete
-- (ADR-0009); unaccent lets an Albanian search for "Durres" find "Durres" with
-- its diacritic, which users will absolutely do.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "foundation";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "integration";

-- CreateTable
CREATE TABLE "audit"."audit_event" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" UUID,
    "owningCompanyId" UUID,
    "projectId" UUID,
    "actorType" TEXT NOT NULL,
    "actorId" UUID,
    "effectiveActorId" UUID,
    "sessionId" UUID,
    "audience" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" UUID,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "ipClass" TEXT,
    "deviceClass" TEXT,
    "changes" JSONB,
    "previousHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."activity_event" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID,
    "projectId" UUID,
    "actorId" UUID,
    "verb" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "summaryKey" TEXT NOT NULL,
    "summaryParams" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'COMPANY',
    "correlationId" TEXT,

    CONSTRAINT "activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'eu-central-1',
    "deploymentClass" TEXT NOT NULL DEFAULT 'SHARED',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."business_group" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reportingCurrency" CHAR(3) NOT NULL,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "business_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."company" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "businessGroupId" UUID,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "city" TEXT,
    "addressLine1" TEXT,
    "postalCode" TEXT,
    "website" TEXT,
    "logoFileId" UUID,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "activatedAt" TIMESTAMPTZ(6),
    "onboardingCompletedAt" TIMESTAMPTZ(6),
    "suspendedAt" TIMESTAMPTZ(6),
    "graceExpiresAt" TIMESTAMPTZ(6),
    "lockedAt" TIMESTAMPTZ(6),
    "deletionEligibleAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "lifecycleReason" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."company_relationship" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentCompanyId" UUID NOT NULL,
    "childCompanyId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "company_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."branch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "city" TEXT,
    "addressLine1" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."company_commercial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "planLabel" TEXT NOT NULL DEFAULT 'STANDARD',
    "seatLimit" INTEGER NOT NULL DEFAULT 10,
    "renewalDate" DATE,
    "billingNotes" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "company_commercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."company_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'sq',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "defaultCurrency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "workweekDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."company_verification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "submittedAt" TIMESTAMPTZ(6),
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedByAdminId" UUID,
    "decisionReason" TEXT,
    "evidenceFileIds" UUID[],
    "officialRepresentative" TEXT,
    "businessEmailDomain" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "company_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."legal_document_version" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "materialChange" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL,
    "publishedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."legal_acceptance" (
    "id" UUID NOT NULL,
    "legalDocumentVersionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "owningCompanyId" UUID,
    "acceptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipClass" TEXT,
    "userAgentClass" TEXT,

    CONSTRAINT "legal_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foundation"."feature_assignment" (
    "id" UUID NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" UUID NOT NULL,
    "moduleId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DISABLED',
    "rolloutFrom" TIMESTAMPTZ(6),
    "rolloutTo" TIMESTAMPTZ(6),
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "feature_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."outbox_event" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID,
    "projectId" UUID,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "publishedAt" TIMESTAMPTZ(6),
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."inbox_message" (
    "id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "eventId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),
    "lastError" TEXT,

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."consumer_checkpoint" (
    "id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "lastEventId" UUID,
    "lastOccurredAt" TIMESTAMPTZ(6),
    "processedCount" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consumer_checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."dead_letter" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "consumer" TEXT,
    "eventId" UUID,
    "eventType" TEXT,
    "tenantId" UUID,
    "envelope" JSONB NOT NULL,
    "failureClass" TEXT NOT NULL,
    "diagnosticRef" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstFailedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastFailedAt" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "replayedAt" TIMESTAMPTZ(6),
    "replayedBy" UUID,
    "replayReason" TEXT,

    CONSTRAINT "dead_letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."idempotency_key" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "responseBody" JSONB,
    "responseStatus" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."search_document" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID,
    "projectId" UUID,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "indexVersion" INTEGER NOT NULL DEFAULT 1,
    "discoveryClass" TEXT NOT NULL DEFAULT 'INTERNAL',
    "requiredPermission" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT NOT NULL,
    "keywords" TEXT[],
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."import_job" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "projectId" UUID,
    "targetType" TEXT NOT NULL,
    "fileObjectId" UUID NOT NULL,
    "mapping" JSONB,
    "validationHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "rowCount" INTEGER,
    "errorCount" INTEGER,
    "errors" JSONB,
    "appliedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "import_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration"."export_job" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "projectId" UUID,
    "scope" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "resultFileId" UUID,
    "rowCount" INTEGER,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "export_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_tenantId_occurredAt_idx" ON "audit"."audit_event"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "audit_event_tenantId_targetType_targetId_idx" ON "audit"."audit_event"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_event_tenantId_actorId_occurredAt_idx" ON "audit"."audit_event"("tenantId", "actorId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "audit_event_action_occurredAt_idx" ON "audit"."audit_event"("action", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_event_tenantId_owningCompanyId_occurredAt_idx" ON "audit"."activity_event"("tenantId", "owningCompanyId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_event_tenantId_projectId_occurredAt_idx" ON "audit"."activity_event"("tenantId", "projectId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "activity_event_tenantId_targetType_targetId_idx" ON "audit"."activity_event"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "tenant_lifecycleStatus_idx" ON "foundation"."tenant"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "business_group_tenantId_idx" ON "foundation"."business_group"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "company_slug_key" ON "foundation"."company"("slug");

-- CreateIndex
CREATE INDEX "company_tenantId_idx" ON "foundation"."company"("tenantId");

-- CreateIndex
CREATE INDEX "company_tenantId_lifecycleStatus_idx" ON "foundation"."company"("tenantId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "company_lifecycleStatus_graceExpiresAt_idx" ON "foundation"."company"("lifecycleStatus", "graceExpiresAt");

-- CreateIndex
CREATE INDEX "company_lifecycleStatus_deletionEligibleAt_idx" ON "foundation"."company"("lifecycleStatus", "deletionEligibleAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_tenantId_legalName_key" ON "foundation"."company"("tenantId", "legalName");

-- CreateIndex
CREATE INDEX "company_relationship_tenantId_idx" ON "foundation"."company_relationship"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "company_relationship_parentCompanyId_childCompanyId_kind_ef_key" ON "foundation"."company_relationship"("parentCompanyId", "childCompanyId", "kind", "effectiveFrom");

-- CreateIndex
CREATE INDEX "branch_tenantId_owningCompanyId_idx" ON "foundation"."branch"("tenantId", "owningCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_owningCompanyId_code_key" ON "foundation"."branch"("owningCompanyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "company_commercial_owningCompanyId_key" ON "foundation"."company_commercial"("owningCompanyId");

-- CreateIndex
CREATE INDEX "company_commercial_tenantId_idx" ON "foundation"."company_commercial"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_owningCompanyId_key" ON "foundation"."company_settings"("owningCompanyId");

-- CreateIndex
CREATE INDEX "company_settings_tenantId_idx" ON "foundation"."company_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "company_verification_owningCompanyId_key" ON "foundation"."company_verification"("owningCompanyId");

-- CreateIndex
CREATE INDEX "company_verification_tenantId_idx" ON "foundation"."company_verification"("tenantId");

-- CreateIndex
CREATE INDEX "company_verification_status_idx" ON "foundation"."company_verification"("status");

-- CreateIndex
CREATE INDEX "legal_document_version_kind_publishedAt_idx" ON "foundation"."legal_document_version"("kind", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_version_kind_version_locale_key" ON "foundation"."legal_document_version"("kind", "version", "locale");

-- CreateIndex
CREATE INDEX "legal_acceptance_userId_idx" ON "foundation"."legal_acceptance"("userId");

-- CreateIndex
CREATE INDEX "legal_acceptance_tenantId_owningCompanyId_idx" ON "foundation"."legal_acceptance"("tenantId", "owningCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptance_legalDocumentVersionId_userId_owningCompan_key" ON "foundation"."legal_acceptance"("legalDocumentVersionId", "userId", "owningCompanyId");

-- CreateIndex
CREATE INDEX "feature_assignment_moduleId_state_idx" ON "foundation"."feature_assignment"("moduleId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "feature_assignment_scopeType_scopeId_moduleId_key" ON "foundation"."feature_assignment"("scopeType", "scopeId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_eventId_key" ON "integration"."outbox_event"("eventId");

-- CreateIndex
CREATE INDEX "outbox_event_status_nextAttemptAt_idx" ON "integration"."outbox_event"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "outbox_event_tenantId_aggregateType_aggregateId_aggregateVe_idx" ON "integration"."outbox_event"("tenantId", "aggregateType", "aggregateId", "aggregateVersion");

-- CreateIndex
CREATE INDEX "inbox_message_consumer_status_idx" ON "integration"."inbox_message"("consumer", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_message_consumer_eventId_key" ON "integration"."inbox_message"("consumer", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "consumer_checkpoint_consumer_key" ON "integration"."consumer_checkpoint"("consumer");

-- CreateIndex
CREATE INDEX "dead_letter_status_lastFailedAt_idx" ON "integration"."dead_letter"("status", "lastFailedAt" DESC);

-- CreateIndex
CREATE INDEX "dead_letter_tenantId_idx" ON "integration"."dead_letter"("tenantId");

-- CreateIndex
CREATE INDEX "idempotency_key_expiresAt_idx" ON "integration"."idempotency_key"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_key_operation_key_key" ON "integration"."idempotency_key"("operation", "key");

-- CreateIndex
CREATE INDEX "search_document_tenantId_owningCompanyId_sourceType_idx" ON "integration"."search_document"("tenantId", "owningCompanyId", "sourceType");

-- CreateIndex
CREATE INDEX "search_document_tenantId_projectId_idx" ON "integration"."search_document"("tenantId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "search_document_sourceType_sourceId_key" ON "integration"."search_document"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "import_job_tenantId_owningCompanyId_status_idx" ON "integration"."import_job"("tenantId", "owningCompanyId", "status");

-- CreateIndex
CREATE INDEX "export_job_tenantId_owningCompanyId_status_idx" ON "integration"."export_job"("tenantId", "owningCompanyId", "status");

-- CreateIndex
CREATE INDEX "export_job_expiresAt_idx" ON "integration"."export_job"("expiresAt");

-- AddForeignKey
ALTER TABLE "foundation"."business_group" ADD CONSTRAINT "business_group_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "foundation"."tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company" ADD CONSTRAINT "company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "foundation"."tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company" ADD CONSTRAINT "company_businessGroupId_fkey" FOREIGN KEY ("businessGroupId") REFERENCES "foundation"."business_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company_relationship" ADD CONSTRAINT "company_relationship_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "foundation"."company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company_relationship" ADD CONSTRAINT "company_relationship_childCompanyId_fkey" FOREIGN KEY ("childCompanyId") REFERENCES "foundation"."company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."branch" ADD CONSTRAINT "branch_owningCompanyId_fkey" FOREIGN KEY ("owningCompanyId") REFERENCES "foundation"."company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company_commercial" ADD CONSTRAINT "company_commercial_owningCompanyId_fkey" FOREIGN KEY ("owningCompanyId") REFERENCES "foundation"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company_settings" ADD CONSTRAINT "company_settings_owningCompanyId_fkey" FOREIGN KEY ("owningCompanyId") REFERENCES "foundation"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."company_verification" ADD CONSTRAINT "company_verification_owningCompanyId_fkey" FOREIGN KEY ("owningCompanyId") REFERENCES "foundation"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foundation"."legal_acceptance" ADD CONSTRAINT "legal_acceptance_legalDocumentVersionId_fkey" FOREIGN KEY ("legalDocumentVersionId") REFERENCES "foundation"."legal_document_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateColumn (search vector, owned by Prisma so migrate diff never drops it)
ALTER TABLE "integration"."search_document" ADD COLUMN     "searchVector" tsvector;

-- CreateIndex
CREATE INDEX "search_document_searchVector_idx" ON "integration"."search_document" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "search_document_title_idx" ON "integration"."search_document" USING GIN ("title" public.gin_trgm_ops);

-- ===========================================================================
-- Phase 0 hardening. Everything below this line is what Prisma's model layer
-- cannot express and what ADR-0002, ADR-0006 and ADR-0008 require.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
-- pg_trgm backs fuzzy search and autocomplete (ADR-0009). unaccent lets an
-- Albanian search for "Durres" find "Durrës", which users will absolutely do.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- 2. The remaining schemas of PRD §11.1
-- ---------------------------------------------------------------------------
-- Prisma creates a schema only when it has a table in it. Creating all 22 now
-- means the grant matrix below is complete from day one and a later phase adds
-- tables to a schema whose permissions were already reviewed.
CREATE SCHEMA IF NOT EXISTS "identity";
CREATE SCHEMA IF NOT EXISTS "authorization";
CREATE SCHEMA IF NOT EXISTS "organization";
CREATE SCHEMA IF NOT EXISTS "projects";
CREATE SCHEMA IF NOT EXISTS "project_core";
CREATE SCHEMA IF NOT EXISTS "tasks";
CREATE SCHEMA IF NOT EXISTS "documents";
CREATE SCHEMA IF NOT EXISTS "contracts";
CREATE SCHEMA IF NOT EXISTS "finance";
CREATE SCHEMA IF NOT EXISTS "procurement";
CREATE SCHEMA IF NOT EXISTS "inventory";
CREATE SCHEMA IF NOT EXISTS "site";
CREATE SCHEMA IF NOT EXISTS "quality";
CREATE SCHEMA IF NOT EXISTS "hse";
CREATE SCHEMA IF NOT EXISTS "hr";
CREATE SCHEMA IF NOT EXISTS "crm";
CREATE SCHEMA IF NOT EXISTS "network";
CREATE SCHEMA IF NOT EXISTS "workflow";
CREATE SCHEMA IF NOT EXISTS "notifications";

-- ---------------------------------------------------------------------------
-- 3. Context helpers
-- ---------------------------------------------------------------------------
-- Deliberately in `public`, which Prisma does not manage, so migrate never
-- treats them as drift.
--
-- STABLE, not IMMUTABLE: the value can change between statements in a
-- transaction if someone re-issues set_config, and the planner must not cache
-- it across that. Marking it IMMUTABLE would be a correctness bug, not an
-- optimisation.
CREATE OR REPLACE FUNCTION public.nesto_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- The PLATFORM audience (§3.1) legitimately spans tenants for lifecycle work.
-- It is set only by the unit of work when the audience is PLATFORM, and it does
-- not grant application-level access — Platform Admin still has no tenant-data
-- explorer (§24.5). This only stops RLS from blocking the operations it does have.
CREATE OR REPLACE FUNCTION public.nesto_is_platform() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.platform', true), ''), 'false')::boolean
$$;

-- ---------------------------------------------------------------------------
-- 4. Roles
-- ---------------------------------------------------------------------------
-- nesto_app is the runtime identity. It is NOT a superuser and does NOT have
-- BYPASSRLS, so every policy below actually applies to the application — which
-- is the only way the isolation suite proves anything.
--
-- Migrations and seeds connect as the owner (DATABASE_URL_DIRECT), which does
-- bypass RLS. That asymmetry is deliberate: bootstrapping a tenant necessarily
-- happens before there is a tenant context to bootstrap it in.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nesto_app') THEN
    CREATE ROLE nesto_app LOGIN PASSWORD 'nesto_app_dev' NOBYPASSRLS;
  END IF;
END $$;

-- Per-domain roles. Created and granted here so the ownership model is real and
-- reviewable; local and CI runtime connects as nesto_app (deviation D-7).
DO $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY ARRAY[
    'foundation','identity','authorization','organization','projects','project_core','tasks',
    'documents','contracts','finance','procurement','inventory','site','quality','hse','hr',
    'crm','network','workflow','notifications','integration','audit'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nesto_' || d) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOBYPASSRLS', 'nesto_' || d);
    END IF;
    -- A domain role may read anywhere it has been granted, but may only write
    -- its own schema. This is the "no domain writes another domain's tables"
    -- rule expressed as a database privilege rather than a code review comment.
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', d, 'nesto_' || d);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', d, 'nesto_' || d);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', d, 'nesto_' || d);
  END LOOP;
END $$;

-- nesto_app gets DML on every schema; the boundary it cannot cross is enforced
-- in the application by the repository layer (ADR-0005). The per-domain roles
-- above are what a service-per-domain deployment would use instead.
DO $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY ARRAY[
    'foundation','identity','authorization','organization','projects','project_core','tasks',
    'documents','contracts','finance','procurement','inventory','site','quality','hse','hr',
    'crm','network','workflow','notifications','integration','audit'
  ] LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO nesto_app', d);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO nesto_app', d);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO nesto_app', d);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nesto_app', d);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO nesto_app', d);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Audit is append-only (ADR-0008)
-- ---------------------------------------------------------------------------
-- Not a service-layer convention: no role holds UPDATE or DELETE on the audit
-- table, so an attempt fails at the database. Deleting a business record cannot
-- take its evidence with it, because there is no foreign key and no privilege.
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM nesto_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_event FROM nesto_audit;
GRANT SELECT, INSERT ON audit.audit_event TO nesto_app;
GRANT SELECT, INSERT ON audit.audit_event TO nesto_audit;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE UPDATE, DELETE ON TABLES FROM nesto_app;

-- activity_event is a projection, so it stays rewritable — it proves nothing
-- and must be rebuildable (§10.3).

-- ---------------------------------------------------------------------------
-- 6. Row level security (ADR-0002)
-- ---------------------------------------------------------------------------
-- FORCE, not just ENABLE: without FORCE the table owner is exempt, and the
-- owner is exactly who the application would connect as in a careless setup.
DO $$
DECLARE
  r record;
  tenant_col text;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.is_nullable
    FROM information_schema.columns c
    WHERE c.column_name = 'tenantId'
      AND c.table_schema IN (
        'foundation','identity','authorization','organization','projects','project_core','tasks',
        'documents','contracts','finance','procurement','inventory','site','quality','hse','hr',
        'crm','network','workflow','notifications','integration','audit')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.table_schema, r.table_name);

    IF r.is_nullable = 'YES' THEN
      -- Rows with a NULL tenant are platform-scope facts (an audit entry for a
      -- company application that has no tenant yet). They are visible only in
      -- the platform audience, never to a tenant session.
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON %I.%I
        USING (
          ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
          OR ("tenantId" IS NULL AND public.nesto_is_platform())
        )
        WITH CHECK (
          ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant())
          OR ("tenantId" IS NULL AND public.nesto_is_platform())
        )
      $f$, r.table_schema, r.table_name);
    ELSE
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON %I.%I
        USING ("tenantId" = public.nesto_current_tenant() OR public.nesto_is_platform())
        WITH CHECK ("tenantId" = public.nesto_current_tenant() OR public.nesto_is_platform())
      $f$, r.table_schema, r.table_name);
    END IF;
  END LOOP;
END $$;

-- foundation.tenant has no tenantId of its own; its id *is* the tenant.
ALTER TABLE foundation.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE foundation.tenant FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON foundation.tenant;
CREATE POLICY tenant_isolation ON foundation.tenant
  USING (id = public.nesto_current_tenant() OR public.nesto_is_platform())
  WITH CHECK (id = public.nesto_current_tenant() OR public.nesto_is_platform());

-- Platform-scope tables with no tenant column at all: published legal versions
-- are readable by everyone (they must be, to be accepted) and writable only in
-- the platform audience.
ALTER TABLE foundation.legal_document_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE foundation.legal_document_version FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_read ON foundation.legal_document_version;
CREATE POLICY legal_read ON foundation.legal_document_version FOR SELECT USING (true);
DROP POLICY IF EXISTS legal_write ON foundation.legal_document_version;
CREATE POLICY legal_write ON foundation.legal_document_version FOR ALL
  USING (public.nesto_is_platform()) WITH CHECK (public.nesto_is_platform());

ALTER TABLE foundation.feature_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE foundation.feature_assignment FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_read ON foundation.feature_assignment;
CREATE POLICY feature_read ON foundation.feature_assignment FOR SELECT
  USING (public.nesto_is_platform() OR "scopeId" = public.nesto_current_tenant()
         OR "scopeId" IN (SELECT id FROM foundation.company WHERE "tenantId" = public.nesto_current_tenant()));
DROP POLICY IF EXISTS feature_write ON foundation.feature_assignment;
CREATE POLICY feature_write ON foundation.feature_assignment FOR ALL
  USING (public.nesto_is_platform()) WITH CHECK (public.nesto_is_platform());

ALTER TABLE integration.consumer_checkpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.consumer_checkpoint FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_only ON integration.consumer_checkpoint;
CREATE POLICY platform_only ON integration.consumer_checkpoint FOR ALL
  USING (public.nesto_is_platform()) WITH CHECK (public.nesto_is_platform());

-- ---------------------------------------------------------------------------
-- 7. Protected state sets (PRD Appendix A)
-- ---------------------------------------------------------------------------
-- Status columns are text so that companies may add mapped display states
-- (Appendix A), but the *protected* sets are closed and belong in the database.
ALTER TABLE foundation.company
  ADD CONSTRAINT company_lifecycle_status_check CHECK ("lifecycleStatus" IN (
    'DRAFT','UNDER_REVIEW','ACTIVE_ONBOARDING','ACTIVE','READ_ONLY_GRACE',
    'LOCKED','DELETION_ELIGIBLE','DELETING','DELETED'));

ALTER TABLE foundation.company
  ADD CONSTRAINT company_verification_status_check CHECK ("verificationStatus" IN (
    'UNVERIFIED','UNDER_REVIEW','VERIFIED','SUSPENDED'));

ALTER TABLE foundation.company_verification
  ADD CONSTRAINT company_verification_state_check CHECK (status IN (
    'UNVERIFIED','UNDER_REVIEW','VERIFIED','SUSPENDED'));

-- A grace period is exactly 120 hours (§9.2) and deletion eligibility is exactly
-- 365 days after lock. Both are recorded as instants so the gate can be computed
-- on read; these constraints stop a caller inventing an ordering that the
-- lifecycle machine would never produce.
ALTER TABLE foundation.company
  ADD CONSTRAINT company_grace_after_suspension CHECK (
    "graceExpiresAt" IS NULL OR "suspendedAt" IS NULL OR "graceExpiresAt" > "suspendedAt");
ALTER TABLE foundation.company
  ADD CONSTRAINT company_deletion_after_lock CHECK (
    "deletionEligibleAt" IS NULL OR "lockedAt" IS NULL OR "deletionEligibleAt" > "lockedAt");

ALTER TABLE integration.outbox_event
  ADD CONSTRAINT outbox_status_check CHECK (status IN (
    'PENDING','PUBLISHING','PUBLISHED','FAILED','DEAD_LETTERED'));

ALTER TABLE audit.audit_event
  ADD CONSTRAINT audit_result_check CHECK (result IN ('SUCCESS','DENIED','FAILED'));

-- ---------------------------------------------------------------------------
-- 8. A note on indexes
-- ---------------------------------------------------------------------------
-- Every index in this platform is declared in the Prisma model, including the
-- GIN/trigram ones, because `migrate diff` drops any index it does not own.
-- Partial indexes (`WHERE status IN ('PENDING','FAILED')`) are not expressible
-- in Prisma and are therefore deferred to the point where measured table size
-- justifies managing them outside the model. They are a size optimisation, not
-- a correctness one; the composite indexes cover the same queries. Recorded in
-- docs/requirements/migration-register.csv.
