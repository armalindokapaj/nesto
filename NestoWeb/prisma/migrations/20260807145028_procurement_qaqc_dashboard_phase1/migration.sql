-- CreateTable
CREATE TABLE "Ncr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inspectionRequestId" TEXT,
    "discipline" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "requirement" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "containmentAction" TEXT,
    "rootCause" TEXT,
    "correctiveActionPlan" TEXT,
    "dueDate" DATETIME,
    "raisedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ncr_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ncr_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ncr_inspectionRequestId_fkey" FOREIGN KEY ("inspectionRequestId") REFERENCES "InspectionRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ncr_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ncr_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DEFECT',
    "location" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "correctiveTaskId" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "closedAt" DATETIME,
    "raisedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Defect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Defect_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Defect_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Defect_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Defect_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QaqcActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QaqcActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QaqcActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcurementComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementComparison_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparison_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ProcurementRfq" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparison_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparison_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparison_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcurementComparisonScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 12.5,
    "score" REAL NOT NULL,
    "evaluatedById" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcurementComparisonScore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparisonScore_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ProcurementComparison" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparisonScore_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProcurementComparisonScore_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AwardRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "recommendedSupplierId" TEXT NOT NULL,
    "recommendedQuotationId" TEXT NOT NULL,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "preparedById" TEXT NOT NULL,
    "preparedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    CONSTRAINT "AwardRecommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ProcurementComparison" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ProcurementRfq" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_recommendedSupplierId_fkey" FOREIGN KEY ("recommendedSupplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_recommendedQuotationId_fkey" FOREIGN KEY ("recommendedQuotationId") REFERENCES "SupplierQuotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AwardRecommendation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "UserIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "number" TEXT NOT NULL,
    "projectId" TEXT,
    "supplierId" TEXT NOT NULL,
    "requestId" TEXT,
    "packageId" TEXT,
    "rfqId" TEXT,
    "quotationId" TEXT,
    "awardRecommendationId" TEXT,
    "title" TEXT,
    "type" TEXT NOT NULL DEFAULT 'STANDARD',
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "freight" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "issueDate" DATETIME,
    "requestedDeliveryDate" DATETIME,
    "confirmedDeliveryDate" DATETIME,
    "deliveryAddress" TEXT,
    "paymentTerms" TEXT,
    "supplierReference" TEXT,
    "acknowledgedAt" DATETIME,
    "issuedSnapshot" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" DATETIME,
    CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ProcurementPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "ProcurementRfq" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_awardRecommendationId_fkey" FOREIGN KEY ("awardRecommendationId") REFERENCES "AwardRecommendation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserIdentity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("acknowledgedAt", "amount", "archivedAt", "companyId", "confirmedDeliveryDate", "createdAt", "currency", "deliveryAddress", "description", "discount", "freight", "id", "issueDate", "issuedSnapshot", "number", "packageId", "paymentTerms", "projectId", "quotationId", "requestId", "requestedById", "requestedDeliveryDate", "rfqId", "status", "subtotal", "supplierId", "supplierReference", "tax", "tenantId", "title", "type", "updatedAt", "version") SELECT "acknowledgedAt", "amount", "archivedAt", "companyId", "confirmedDeliveryDate", "createdAt", "currency", "deliveryAddress", "description", "discount", "freight", "id", "issueDate", "issuedSnapshot", "number", "packageId", "paymentTerms", "projectId", "quotationId", "requestId", "requestedById", "requestedDeliveryDate", "rfqId", "status", "subtotal", "supplierId", "supplierReference", "tax", "tenantId", "title", "type", "updatedAt", "version" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_number_key" ON "PurchaseOrder"("tenantId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Ncr_tenantId_projectId_status_idx" ON "Ncr"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ncr_tenantId_number_key" ON "Ncr"("tenantId", "number");

-- CreateIndex
CREATE INDEX "Defect_tenantId_projectId_status_idx" ON "Defect"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "Defect_tenantId_type_idx" ON "Defect"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Defect_tenantId_number_key" ON "Defect"("tenantId", "number");

-- CreateIndex
CREATE INDEX "QaqcActivity_tenantId_entityType_entityId_idx" ON "QaqcActivity"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ProcurementComparison_tenantId_rfqId_idx" ON "ProcurementComparison"("tenantId", "rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementComparison_tenantId_number_key" ON "ProcurementComparison"("tenantId", "number");

-- CreateIndex
CREATE INDEX "ProcurementComparisonScore_tenantId_comparisonId_idx" ON "ProcurementComparisonScore"("tenantId", "comparisonId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementComparisonScore_comparisonId_quotationId_criterion_key" ON "ProcurementComparisonScore"("comparisonId", "quotationId", "criterion");

-- CreateIndex
CREATE INDEX "AwardRecommendation_tenantId_rfqId_status_idx" ON "AwardRecommendation"("tenantId", "rfqId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AwardRecommendation_tenantId_number_key" ON "AwardRecommendation"("tenantId", "number");
