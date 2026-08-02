-- CreateTable
CREATE TABLE "TaskStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "skippedById" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskStage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskStage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskStage_skippedById_fkey" FOREIGN KEY ("skippedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "activatedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskDepartment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDepartment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDepartment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentDeliverable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskDepartmentId" TEXT NOT NULL,
    "requiredAction" TEXT NOT NULL,
    "expectedOutput" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "notRequiredReason" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "blockedByDeliverableId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentDeliverable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentDeliverable_taskDepartmentId_fkey" FOREIGN KEY ("taskDepartmentId") REFERENCES "TaskDepartment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentDeliverable_blockedByDeliverableId_fkey" FOREIGN KEY ("blockedByDeliverableId") REFERENCES "DepartmentDeliverable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskParticipant_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "approverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "conditions" TEXT,
    "conditionsMet" BOOLEAN NOT NULL DEFAULT false,
    "delegatedToId" TEXT,
    "fileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskApproval_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "DepartmentDeliverable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskApproval_delegatedToId_fkey" FOREIGN KEY ("delegatedToId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentInvolvementRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedAction" TEXT,
    "desiredDeadline" DATETIME,
    "shouldBlock" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "redirectDepartment" TEXT,
    "respondedById" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentInvolvementRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentInvolvementRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentInvolvementRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DepartmentInvolvementRequest_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskEscalation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "acknowledgedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskEscalation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskEscalation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskEscalation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskEscalation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskDelayExplanation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "deliverableId" TEXT,
    "cause" TEXT NOT NULL,
    "progressPct" INTEGER NOT NULL,
    "newExpectedDate" DATETIME NOT NULL,
    "blockingDependency" TEXT,
    "costImpact" REAL,
    "scheduleImpactDays" INTEGER,
    "correctiveAction" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskDelayExplanation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDelayExplanation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDelayExplanation_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "DepartmentDeliverable" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskDelayExplanation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskContractLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contractId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskContractLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskContractLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskContractLink_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskContractLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskContractorAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractId" TEXT,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "plannedStart" DATETIME,
    "deadline" DATETIME,
    "acceptedAt" DATETIME,
    "readyForInspectionAt" DATETIME,
    "assignedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskContractorAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskContractorAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskContractorAssignment_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskContractorAssignment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskContractorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "inspectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskInspection_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskCompletionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "actualDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gatesSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskCompletionRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskCompletionRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskCompletionRecord_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskReopeningRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reopenedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "newIssue" TEXT,
    "newDeadline" DATETIME,
    "riskImpact" TEXT,
    "previousCompletionRecordId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskReopeningRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskReopeningRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskReopeningRecord_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskReopeningRecord_previousCompletionRecordId_fkey" FOREIGN KEY ("previousCompletionRecordId") REFERENCES "TaskCompletionRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contractor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "riskRating" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Contractor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contractor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contractor" ("createdAt", "email", "id", "name", "number", "phone", "riskRating", "status", "tenantId", "tradeType") SELECT "createdAt", "email", "id", "name", "number", "phone", "riskRating", "status", "tenantId", "tradeType" FROM "Contractor";
DROP TABLE "Contractor";
ALTER TABLE "new_Contractor" RENAME TO "Contractor";
CREATE UNIQUE INDEX "Contractor_userId_key" ON "Contractor"("userId");
CREATE TABLE "new_DocumentFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "taskStageId" TEXT,
    "taskDepartmentId" TEXT,
    CONSTRAINT "DocumentFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "DocumentFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentFile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentFile" ("category", "clientId", "createdAt", "id", "name", "projectId", "status", "taskId", "tenantId", "uploadedById", "version") SELECT "category", "clientId", "createdAt", "id", "name", "projectId", "status", "taskId", "tenantId", "uploadedById", "version" FROM "DocumentFile";
DROP TABLE "DocumentFile";
ALTER TABLE "new_DocumentFile" RENAME TO "DocumentFile";
CREATE UNIQUE INDEX "DocumentFile_supersedesId_key" ON "DocumentFile"("supersedesId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'COMPANY_PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'TO_DO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATETIME,
    "createdById" TEXT NOT NULL,
    "mainResponsibleId" TEXT,
    "sourceCommentId" TEXT,
    "departmentRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "orchestrationStatus" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "riskLevel" TEXT,
    "locationDetail" TEXT,
    "startDate" DATETIME,
    "forecastDate" DATETIME,
    "actualCompletionDate" DATETIME,
    "taskManagerId" TEXT,
    "decisionOwnerId" TEXT,
    "finalApproverId" TEXT,
    "currentStageId" TEXT,
    CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_mainResponsibleId_fkey" FOREIGN KEY ("mainResponsibleId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sourceCommentId_fkey" FOREIGN KEY ("sourceCommentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_taskManagerId_fkey" FOREIGN KEY ("taskManagerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_decisionOwnerId_fkey" FOREIGN KEY ("decisionOwnerId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_finalApproverId_fkey" FOREIGN KEY ("finalApproverId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "TaskStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("clientId", "code", "createdAt", "createdById", "departmentRole", "description", "dueDate", "id", "mainResponsibleId", "priority", "projectId", "sourceCommentId", "status", "tenantId", "title", "updatedAt", "visibility") SELECT "clientId", "code", "createdAt", "createdById", "departmentRole", "description", "dueDate", "id", "mainResponsibleId", "priority", "projectId", "sourceCommentId", "status", "tenantId", "title", "updatedAt", "visibility" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_sourceCommentId_key" ON "Task"("sourceCommentId");
CREATE UNIQUE INDEX "Task_tenantId_code_key" ON "Task"("tenantId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaskStage_taskId_key_key" ON "TaskStage"("taskId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDepartment_taskId_department_key" ON "TaskDepartment"("taskId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentDeliverable_taskDepartmentId_key" ON "DepartmentDeliverable"("taskDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskParticipant_taskId_userId_role_key" ON "TaskParticipant"("taskId", "userId", "role");
