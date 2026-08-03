-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_tenantId_status_idx" ON "Client"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_projectId_idx" ON "Contract"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Contractor_tenantId_status_idx" ON "Contractor"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DocumentFile_tenantId_projectId_idx" ON "DocumentFile"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "DocumentFile_tenantId_taskId_idx" ON "DocumentFile"("tenantId", "taskId");

-- CreateIndex
CREATE INDEX "DocumentFile_tenantId_clientId_idx" ON "DocumentFile"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_department_idx" ON "Employee"("tenantId", "department");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_type_idx" ON "Invoice"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_employeeId_idx" ON "LeaveRequest"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_scheduledAt_idx" ON "Meeting"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_projectId_idx" ON "Task"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "Task_tenantId_dueDate_idx" ON "Task"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_mainResponsibleId_idx" ON "Task"("mainResponsibleId");

-- CreateIndex
CREATE INDEX "TaskApproval_taskId_idx" ON "TaskApproval"("taskId");

-- CreateIndex
CREATE INDEX "TaskApproval_delegatedToId_idx" ON "TaskApproval"("delegatedToId");

-- CreateIndex
CREATE INDEX "TaskEscalation_toUserId_idx" ON "TaskEscalation"("toUserId");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");
