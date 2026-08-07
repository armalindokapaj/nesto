-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowDefinitionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStageTemplate_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "sourceRecordVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStageSequence" INTEGER,
    "submittedById" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowInstance_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowInstance_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStageInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowInstanceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStageInstance_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "stageInstanceId" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowDecision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowDecision_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowDecision_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "WorkflowStageInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCapabilityGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "UserCapabilityGrant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCapabilityGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCapabilityGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItDepartmentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'BASIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItDepartmentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SoftwareLicence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "vendor" TEXT,
    "seatsTotal" INTEGER NOT NULL,
    "expiresAt" DATETIME,
    "costPerSeat" REAL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoftwareLicence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LicenceAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "LicenceAssignment_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "SoftwareLicence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItServiceTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "requestedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItServiceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItTicketComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItTicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ItServiceTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegisteredDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "RegisteredDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegisteredDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalOrganization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "linkedClientId" TEXT,
    "linkedSupplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalOrganization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "externalOrgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portalRole" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "addedById" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortalMembership_externalOrgId_fkey" FOREIGN KEY ("externalOrgId") REFERENCES "ExternalOrganization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PortalMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessAccessRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "externalOrgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "BusinessAccessRelationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessAccessRelationship_externalOrgId_fkey" FOREIGN KEY ("externalOrgId") REFERENCES "ExternalOrganization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessAccessRelationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorkflowDefinition_tenantId_sourceModule_sourceEntityType_idx" ON "WorkflowDefinition"("tenantId", "sourceModule", "sourceEntityType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_tenantId_key_key" ON "WorkflowDefinition"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageTemplate_workflowDefinitionId_sequence_key" ON "WorkflowStageTemplate"("workflowDefinitionId", "sequence");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_sourceModule_sourceEntityType_sourceEntityId_idx" ON "WorkflowInstance"("tenantId", "sourceModule", "sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_status_idx" ON "WorkflowInstance"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStageInstance_workflowInstanceId_sequence_key" ON "WorkflowStageInstance"("workflowInstanceId", "sequence");

-- CreateIndex
CREATE INDEX "WorkflowDecision_tenantId_workflowInstanceId_idx" ON "WorkflowDecision"("tenantId", "workflowInstanceId");

-- CreateIndex
CREATE INDEX "UserCapabilityGrant_tenantId_capabilityKey_idx" ON "UserCapabilityGrant"("tenantId", "capabilityKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserCapabilityGrant_userId_capabilityKey_key" ON "UserCapabilityGrant"("userId", "capabilityKey");

-- CreateIndex
CREATE UNIQUE INDEX "ItDepartmentProfile_tenantId_key" ON "ItDepartmentProfile"("tenantId");

-- CreateIndex
CREATE INDEX "ItDevice_tenantId_status_idx" ON "ItDevice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SoftwareLicence_tenantId_idx" ON "SoftwareLicence"("tenantId");

-- CreateIndex
CREATE INDEX "LicenceAssignment_licenceId_idx" ON "LicenceAssignment"("licenceId");

-- CreateIndex
CREATE INDEX "ItServiceTicket_tenantId_status_idx" ON "ItServiceTicket"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ItServiceTicket_tenantId_ticketType_idx" ON "ItServiceTicket"("tenantId", "ticketType");

-- CreateIndex
CREATE INDEX "ItTicketComment_ticketId_idx" ON "ItTicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "RegisteredDevice_tenantId_userId_idx" ON "RegisteredDevice"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ExternalOrganization_tenantId_orgType_idx" ON "ExternalOrganization"("tenantId", "orgType");

-- CreateIndex
CREATE UNIQUE INDEX "PortalMembership_externalOrgId_userId_key" ON "PortalMembership"("externalOrgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccessRelationship_externalOrgId_projectId_key" ON "BusinessAccessRelationship"("externalOrgId", "projectId");
