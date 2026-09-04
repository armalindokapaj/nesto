-- DropIndex
DROP INDEX "integration"."search_document_title_idx";

-- CreateTable
CREATE TABLE "authorization"."permission_grant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'ALLOW',
    "scopeType" TEXT NOT NULL DEFAULT 'COMPANY',
    "scopeId" UUID,
    "reason" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "permission_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."user" (
    "id" UUID NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarFileId" UUID,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "locale" TEXT NOT NULL DEFAULT 'sq',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "lastSignInAt" TIMESTAMPTZ(6),
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."credential" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSetAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."security_stamp" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stamp" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "security_stamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "audience" TEXT NOT NULL,
    "tokenFamilyId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rotatedToId" UUID,
    "activeCompanyId" UUID,
    "activeProjectId" UUID,
    "ipClass" TEXT,
    "deviceLabel" TEXT,
    "userAgent" TEXT,
    "lastStrongAuthAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."mfa_method" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TOTP',
    "encryptedSecret" TEXT NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "lastUsedCounter" BIGINT,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMPTZ(6),

    CONSTRAINT "mfa_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."recovery_code" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."invitation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "departmentId" UUID,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "resendOfId" UUID,
    "acceptedAt" TIMESTAMPTZ(6),
    "acceptedUserId" UUID,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."onboarding_progress" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "currentStep" TEXT NOT NULL DEFAULT 'WELCOME',
    "completedSteps" TEXT[],
    "stepData" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."login_attempt" (
    "id" UUID NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "ipClass" TEXT,
    "audience" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "attemptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "projectId" UUID,
    "recipientMembershipId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "titleKey" TEXT NOT NULL,
    "bodyKey" TEXT NOT NULL,
    "params" JSONB,
    "targetType" TEXT,
    "targetId" UUID,
    "targetPath" TEXT,
    "readAt" TIMESTAMPTZ(6),
    "dismissedAt" TIMESTAMPTZ(6),
    "dedupeKey" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."delivery_attempt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "suppressionReason" TEXT,
    "providerRef" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_preference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "timezone" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."department" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "managerMembershipId" UUID,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization"."company_membership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "departmentId" UUID,
    "managerMembershipId" UUID,
    "jobTitle" TEXT,
    "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "endReason" TEXT,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "company_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."template_family" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isProtected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "template_family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."template_version" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "changeNotes" TEXT,
    "publishedAt" TIMESTAMPTZ(6) NOT NULL,
    "publishedBy" UUID NOT NULL,
    "retiredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."company_template_variation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "baseVersionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "overrides" JSONB NOT NULL,
    "overridesHash" TEXT NOT NULL,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "company_template_variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'BUILDING',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'PROVISIONING',
    "statusReason" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "plannedStart" DATE,
    "plannedFinish" DATE,
    "actualStart" DATE,
    "actualFinish" DATE,
    "managerMembershipId" UUID,
    "clientId" UUID,
    "computedHealth" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "healthOverride" TEXT,
    "healthOverrideReason" TEXT,
    "healthOverrideExpiresAt" TIMESTAMPTZ(6),
    "activatedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),
    "archivedBy" UUID,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_template_snapshot" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "variationId" UUID,
    "version" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_template_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."provisioning_step" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "handler" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorRef" TEXT,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provisioning_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects"."project_membership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "owningCompanyId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "projectRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "recordVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "project_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permission_grant_tenantId_owningCompanyId_subjectId_idx" ON "authorization"."permission_grant"("tenantId", "owningCompanyId", "subjectId");

-- CreateIndex
CREATE INDEX "permission_grant_expiresAt_idx" ON "authorization"."permission_grant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "permission_grant_subjectType_subjectId_permissionKey_scopeT_key" ON "authorization"."permission_grant"("subjectType", "subjectId", "permissionKey", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_normalizedEmail_key" ON "identity"."user"("normalizedEmail");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "identity"."user"("status");

-- CreateIndex
CREATE UNIQUE INDEX "credential_userId_key" ON "identity"."credential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "security_stamp_userId_key" ON "identity"."security_stamp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_refreshTokenHash_key" ON "identity"."session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "session_userId_status_idx" ON "identity"."session"("userId", "status");

-- CreateIndex
CREATE INDEX "session_tokenFamilyId_idx" ON "identity"."session"("tokenFamilyId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "identity"."session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_method_userId_kind_key" ON "identity"."mfa_method"("userId", "kind");

-- CreateIndex
CREATE INDEX "recovery_code_userId_usedAt_idx" ON "identity"."recovery_code"("userId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokenHash_key" ON "identity"."invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "invitation_tenantId_owningCompanyId_status_idx" ON "identity"."invitation"("tenantId", "owningCompanyId", "status");

-- CreateIndex
CREATE INDEX "invitation_normalizedEmail_status_idx" ON "identity"."invitation"("normalizedEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_owningCompanyId_key" ON "identity"."onboarding_progress"("owningCompanyId");

-- CreateIndex
CREATE INDEX "onboarding_progress_tenantId_idx" ON "identity"."onboarding_progress"("tenantId");

-- CreateIndex
CREATE INDEX "login_attempt_normalizedEmail_attemptedAt_idx" ON "identity"."login_attempt"("normalizedEmail", "attemptedAt" DESC);

-- CreateIndex
CREATE INDEX "notification_tenantId_recipientMembershipId_readAt_createdA_idx" ON "notifications"."notification"("tenantId", "recipientMembershipId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notification_tenantId_owningCompanyId_createdAt_idx" ON "notifications"."notification"("tenantId", "owningCompanyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipientMembershipId_dedupeKey_key" ON "notifications"."notification"("recipientMembershipId", "dedupeKey");

-- CreateIndex
CREATE INDEX "delivery_attempt_tenantId_status_createdAt_idx" ON "notifications"."delivery_attempt"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "delivery_attempt_notificationId_idx" ON "notifications"."delivery_attempt"("notificationId");

-- CreateIndex
CREATE INDEX "notification_preference_tenantId_owningCompanyId_idx" ON "notifications"."notification_preference"("tenantId", "owningCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_membershipId_kind_key" ON "notifications"."notification_preference"("membershipId", "kind");

-- CreateIndex
CREATE INDEX "department_tenantId_owningCompanyId_idx" ON "organization"."department"("tenantId", "owningCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "department_owningCompanyId_code_key" ON "organization"."department"("owningCompanyId", "code");

-- CreateIndex
CREATE INDEX "company_membership_tenantId_owningCompanyId_status_idx" ON "organization"."company_membership"("tenantId", "owningCompanyId", "status");

-- CreateIndex
CREATE INDEX "company_membership_userId_status_idx" ON "organization"."company_membership"("userId", "status");

-- CreateIndex
CREATE INDEX "company_membership_owningCompanyId_role_idx" ON "organization"."company_membership"("owningCompanyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "company_membership_owningCompanyId_userId_key" ON "organization"."company_membership"("owningCompanyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_family_key_key" ON "projects"."template_family"("key");

-- CreateIndex
CREATE INDEX "template_version_familyId_publishedAt_idx" ON "projects"."template_version"("familyId", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "template_version_familyId_version_key" ON "projects"."template_version"("familyId", "version");

-- CreateIndex
CREATE INDEX "company_template_variation_tenantId_owningCompanyId_idx" ON "projects"."company_template_variation"("tenantId", "owningCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "company_template_variation_owningCompanyId_familyId_name_key" ON "projects"."company_template_variation"("owningCompanyId", "familyId", "name");

-- CreateIndex
CREATE INDEX "project_tenantId_owningCompanyId_lifecycleStatus_idx" ON "projects"."project"("tenantId", "owningCompanyId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "project_tenantId_owningCompanyId_createdAt_idx" ON "projects"."project"("tenantId", "owningCompanyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "project_owningCompanyId_code_key" ON "projects"."project"("owningCompanyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "project_template_snapshot_projectId_key" ON "projects"."project_template_snapshot"("projectId");

-- CreateIndex
CREATE INDEX "project_template_snapshot_tenantId_idx" ON "projects"."project_template_snapshot"("tenantId");

-- CreateIndex
CREATE INDEX "provisioning_step_tenantId_projectId_status_idx" ON "projects"."provisioning_step"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_step_projectId_handler_key" ON "projects"."provisioning_step"("projectId", "handler");

-- CreateIndex
CREATE INDEX "project_membership_tenantId_projectId_status_idx" ON "projects"."project_membership"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "project_membership_membershipId_status_idx" ON "projects"."project_membership"("membershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_membership_projectId_membershipId_key" ON "projects"."project_membership"("projectId", "membershipId");

-- CreateIndex
CREATE INDEX "search_document_title_idx" ON "integration"."search_document" USING GIN ("title" public.gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "identity"."credential" ADD CONSTRAINT "credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."security_stamp" ADD CONSTRAINT "security_stamp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."mfa_method" ADD CONSTRAINT "mfa_method_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."recovery_code" ADD CONSTRAINT "recovery_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."invitation" ADD CONSTRAINT "invitation_resendOfId_fkey" FOREIGN KEY ("resendOfId") REFERENCES "identity"."invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications"."delivery_attempt" ADD CONSTRAINT "delivery_attempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"."notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."department" ADD CONSTRAINT "department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organization"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."company_membership" ADD CONSTRAINT "company_membership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "organization"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."template_version" ADD CONSTRAINT "template_version_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "projects"."template_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."company_template_variation" ADD CONSTRAINT "company_template_variation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "projects"."template_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."company_template_variation" ADD CONSTRAINT "company_template_variation_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "projects"."template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_template_snapshot" ADD CONSTRAINT "project_template_snapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_template_snapshot" ADD CONSTRAINT "project_template_snapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "projects"."template_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."provisioning_step" ADD CONSTRAINT "provisioning_step_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects"."project_membership" ADD CONSTRAINT "project_membership_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"."project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- Phase 1 invariants that belong in the database, not in a service check.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Exactly one Primary Owner per live company (§8.6, ACC-13)
-- ---------------------------------------------------------------------------
-- A service-layer check cannot hold this: two concurrent promotions both read
-- "no owner yet" and both write. A partial unique index makes the second write
-- fail at the database, which is the only place the guarantee can actually live.
CREATE UNIQUE INDEX company_single_primary_owner_idx
  ON organization.company_membership ("owningCompanyId")
  WHERE "isPrimaryOwner" = true AND status <> 'ENDED';

-- An Owner membership must actually carry the OWNER role. Without this the two
-- can drift and "who is the owner" gets two different answers.
ALTER TABLE organization.company_membership
  ADD CONSTRAINT membership_primary_owner_is_owner_role
  CHECK ("isPrimaryOwner" = false OR role = 'OWNER');

-- The 14 protected base roles of §8.2. Companies may relabel these for display;
-- they may not invent one, because permissions are resolved from this value.
ALTER TABLE organization.company_membership
  ADD CONSTRAINT membership_role_check CHECK (role IN (
    'OWNER','COMPANY_ADMIN','EXECUTIVE','PROJECT_MANAGER','ARCHITECT','ENGINEER',
    'FINANCE','PROCUREMENT','HR','SALES','HSE','QA_QC','IT','FIELD'));

ALTER TABLE organization.company_membership
  ADD CONSTRAINT membership_status_check CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','ENDED'));

-- ---------------------------------------------------------------------------
-- Protected state sets (Appendix A)
-- ---------------------------------------------------------------------------
ALTER TABLE identity."user"
  ADD CONSTRAINT user_status_check CHECK (status IN ('INVITED','ACTIVE','DISABLED'));

ALTER TABLE identity.session
  ADD CONSTRAINT session_status_check CHECK (status IN ('ACTIVE','ROTATED','REVOKED','EXPIRED'));

ALTER TABLE identity.session
  ADD CONSTRAINT session_audience_check CHECK (audience IN ('COMPANY','PLATFORM','EXTERNAL_PORTAL'));

ALTER TABLE identity.invitation
  ADD CONSTRAINT invitation_status_check CHECK (status IN ('PENDING','ACCEPTED','REVOKED','EXPIRED'));

ALTER TABLE projects.project
  ADD CONSTRAINT project_lifecycle_check CHECK ("lifecycleStatus" IN (
    'PROVISIONING','DRAFT','ACTIVE','ON_HOLD','CLOSED','ARCHIVED'));

ALTER TABLE projects.project_membership
  ADD CONSTRAINT project_membership_role_check CHECK ("projectRole" IN (
    'MANAGER','PLANNER','COORDINATOR','CONTRIBUTOR','VIEWER'));

ALTER TABLE projects.project_membership
  ADD CONSTRAINT project_membership_status_check CHECK (status IN ('SCHEDULED','ACTIVE','ENDED'));

ALTER TABLE projects.provisioning_step
  ADD CONSTRAINT provisioning_status_check CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED'));

ALTER TABLE "authorization".permission_grant
  ADD CONSTRAINT grant_effect_check CHECK (effect IN ('ALLOW','DENY'));

-- ---------------------------------------------------------------------------
-- Immutability (§9.5)
-- ---------------------------------------------------------------------------
-- A published template version is what live projects pinned their snapshot to.
-- Editing one would retroactively change what an existing project was built
-- from, so the payload and its hash are frozen by a trigger rather than by a
-- convention someone will eventually forget.
CREATE OR REPLACE FUNCTION projects.reject_template_version_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.payload IS DISTINCT FROM NEW.payload
     OR OLD."payloadHash" IS DISTINCT FROM NEW."payloadHash"
     OR OLD.version IS DISTINCT FROM NEW.version THEN
    RAISE EXCEPTION 'A published template version is immutable. Publish a new version instead.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER template_version_immutable
  BEFORE UPDATE ON projects.template_version
  FOR EACH ROW EXECUTE FUNCTION projects.reject_template_version_mutation();

-- The same for a project's snapshot: it is the record of what this project was
-- provisioned from, and it must stay true even after the family moves on.
CREATE OR REPLACE FUNCTION projects.reject_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A project template snapshot is immutable (PRD §9.5).';
END $$;

CREATE TRIGGER project_snapshot_immutable
  BEFORE UPDATE ON projects.project_template_snapshot
  FOR EACH ROW EXECUTE FUNCTION projects.reject_snapshot_mutation();

-- ---------------------------------------------------------------------------
-- Grants and RLS for the new schemas
-- ---------------------------------------------------------------------------
DO $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY ARRAY['identity','authorization','organization','projects','notifications'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO nesto_app', d);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO nesto_app', d);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', d, 'nesto_' || d);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.is_nullable
    FROM information_schema.columns c
    WHERE c.column_name = 'tenantId'
      AND c.table_schema IN ('identity','authorization','organization','projects','notifications')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.table_schema, r.table_name);
    IF r.is_nullable = 'YES' THEN
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON %I.%I
        USING (public.nesto_is_platform() OR ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant()))
        WITH CHECK (public.nesto_is_platform() OR ("tenantId" IS NOT NULL AND "tenantId" = public.nesto_current_tenant()))
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

-- identity.user, credential, session, mfa_method, recovery_code and
-- login_attempt have no tenant column, and correctly so: an account is global
-- and may hold memberships in several companies (§7.1). Isolation for these is
-- the application's membership check, not RLS — an account is not tenant data.
-- The platform-only tables that *are* controlled here:
ALTER TABLE projects.template_family ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.template_family FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS template_read ON projects.template_family;
CREATE POLICY template_read ON projects.template_family FOR SELECT USING (true);
DROP POLICY IF EXISTS template_write ON projects.template_family;
CREATE POLICY template_write ON projects.template_family FOR ALL
  USING (public.nesto_is_platform()) WITH CHECK (public.nesto_is_platform());

ALTER TABLE projects.template_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.template_version FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS template_version_read ON projects.template_version;
CREATE POLICY template_version_read ON projects.template_version FOR SELECT USING (true);
DROP POLICY IF EXISTS template_version_write ON projects.template_version;
CREATE POLICY template_version_write ON projects.template_version FOR ALL
  USING (public.nesto_is_platform()) WITH CHECK (public.nesto_is_platform());
