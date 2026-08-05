-- CreateTable
CREATE TABLE "EmploymentRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "contractType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "reportsToId" TEXT,
    "effectiveStartDate" DATETIME NOT NULL,
    "effectiveEndDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "transferredFromId" TEXT,
    "confidentialityZone" TEXT NOT NULL DEFAULT 'INTERNAL_PROFESSIONAL',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmploymentRelationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmploymentRelationship_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmploymentRelationship_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmploymentRelationship_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmploymentRelationship_transferredFromId_fkey" FOREIGN KEY ("transferredFromId") REFERENCES "EmploymentRelationship" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EmploymentRelationship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HrActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HrActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalAuthority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MUNICIPAL',
    "contactInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAuthority_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issuedDate" DATETIME,
    "expiryDate" DATETIME,
    "confidentialityLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Permit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Permit_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "LegalAuthority" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Permit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermitCondition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermitCondition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PermitCondition_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermitAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "newExpiryDate" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermitAmendment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PermitAmendment_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PermitAmendment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalReadinessStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "reason" TEXT,
    "setById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LegalReadinessStatus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegalReadinessStatus_setById_fkey" FOREIGN KEY ("setById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LegalActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hazard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "likelihood" TEXT NOT NULL DEFAULT 'POSSIBLE',
    "severity" TEXT NOT NULL DEFAULT 'MODERATE',
    "controlLevel" TEXT NOT NULL DEFAULT 'ADMINISTRATIVE',
    "controlNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "identifiedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hazard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hazard_identifiedById_fkey" FOREIGN KEY ("identifiedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hazardId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "approvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "Hazard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermitToWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "requestedById" TEXT NOT NULL,
    "issuedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PermitToWork_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PermitToWork_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PermitToWork_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StopWorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'PROJECT',
    "scopeRef" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedById" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedById" TEXT,
    "releasedAt" DATETIME,
    "releaseNotes" TEXT,
    CONSTRAINT "StopWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StopWorkOrder_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StopWorkOrder_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HseActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HseActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HseActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentRelationship_transferredFromId_key" ON "EmploymentRelationship"("transferredFromId");

-- CreateIndex
CREATE INDEX "EmploymentRelationship_tenantId_employeeId_idx" ON "EmploymentRelationship"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "EmploymentRelationship_tenantId_status_idx" ON "EmploymentRelationship"("tenantId", "status");

-- CreateIndex
CREATE INDEX "HrActivity_tenantId_entityType_entityId_idx" ON "HrActivity"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "LegalAuthority_tenantId_idx" ON "LegalAuthority"("tenantId");

-- CreateIndex
CREATE INDEX "Permit_tenantId_projectId_idx" ON "Permit"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Permit_tenantId_status_idx" ON "Permit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PermitCondition_tenantId_permitId_idx" ON "PermitCondition"("tenantId", "permitId");

-- CreateIndex
CREATE INDEX "PermitAmendment_tenantId_permitId_idx" ON "PermitAmendment"("tenantId", "permitId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalReadinessStatus_projectId_key" ON "LegalReadinessStatus"("projectId");

-- CreateIndex
CREATE INDEX "LegalReadinessStatus_tenantId_idx" ON "LegalReadinessStatus"("tenantId");

-- CreateIndex
CREATE INDEX "LegalActivity_tenantId_entityType_entityId_idx" ON "LegalActivity"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Hazard_tenantId_projectId_idx" ON "Hazard"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Hazard_tenantId_status_idx" ON "Hazard"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RiskAssessment_tenantId_projectId_idx" ON "RiskAssessment"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "RiskAssessment_tenantId_status_idx" ON "RiskAssessment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PermitToWork_tenantId_projectId_idx" ON "PermitToWork"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "PermitToWork_tenantId_status_idx" ON "PermitToWork"("tenantId", "status");

-- CreateIndex
CREATE INDEX "StopWorkOrder_tenantId_projectId_idx" ON "StopWorkOrder"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "StopWorkOrder_tenantId_status_idx" ON "StopWorkOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "HseActivity_tenantId_entityType_entityId_idx" ON "HseActivity"("tenantId", "entityType", "entityId");

