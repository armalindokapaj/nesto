import "server-only";

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { allocateNumber } from "@/server/number-series";
import { assertTenant, requireTenantProject, requireTenantSupplier } from "@/lib/tenant";
import { calculateProcurementTotalsMinor, deriveDocumentStatus, isProcurementTransitionAllowed } from "@/lib/procurement";
import { toMinorUnits, sumMinor } from "@/lib/money";

// Procurement — the core write surface: suppliers and their qualifications,
// purchase requests, packages, RFQs and quotations, purchase orders and
// deliveries, plus the activity log every transition appends to.
//
// Two sibling files, each split for a stated reason:
//   - procurement-comparison.ts — quotation scoring and award recommendation
//     (PRD_Procurement_Dashboard §10/§11). Kept apart because award decisions
//     are a separate actor from the buyer who runs the RFQ.
//   - procurement-dashboard.ts  — read-only dashboard aggregation (§4/§5).

type ActivityInput = {
  tenantId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  summary: string;
  previousStatus?: string;
  nextStatus?: string;
  metadata?: unknown;
};

async function writeActivity(input: ActivityInput) {
  return db.procurementActivity.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      summary: input.summary,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      correlationId: randomUUID(),
    },
  });
}

async function requireTenantCompany(tenantId: string, companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true, tenantId: true } });
  return assertTenant(company, tenantId, "Company");
}

async function requireTenantRecord(model: "purchaseRequest" | "procurementPackage" | "procurementRfq" | "supplierQuotation", tenantId: string, id?: string) {
  if (!id) return;
  const record = model === "purchaseRequest"
    ? await db.purchaseRequest.findUnique({ where: { id }, select: { tenantId: true } })
    : model === "procurementPackage"
      ? await db.procurementPackage.findUnique({ where: { id }, select: { tenantId: true } })
      : model === "procurementRfq"
        ? await db.procurementRfq.findUnique({ where: { id }, select: { tenantId: true } })
        : await db.supplierQuotation.findUnique({ where: { id }, select: { tenantId: true } });
  assertTenant(record, tenantId, model);
}

export async function getProcurementDashboardData(tenantId: string) {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86400000);
  const [suppliers, requests, rfqs, purchaseOrders, deliveries, activity] = await Promise.all([
    db.supplier.findMany({ where: { tenantId, archivedAt: null }, orderBy: { createdAt: "desc" } }),
    db.purchaseRequest.findMany({ where: { tenantId, archivedAt: null }, include: { project: true }, orderBy: { createdAt: "desc" } }),
    db.procurementRfq.findMany({ where: { tenantId }, include: { _count: { select: { suppliers: true, quotations: true } } }, orderBy: { createdAt: "desc" } }),
    db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null }, include: { supplier: true, project: true }, orderBy: { createdAt: "desc" } }),
    db.procurementDelivery.findMany({ where: { tenantId }, include: { supplier: true, purchaseOrder: true }, orderBy: { createdAt: "desc" } }),
    db.procurementActivity.findMany({ where: { tenantId }, include: { actor: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const openOrders = purchaseOrders.filter((po) => !["CLOSED", "CANCELLED", "ARCHIVED"].includes(po.status));
  const openRequests = requests.filter((r) => !["CLOSED", "REJECTED", "CANCELLED", "ARCHIVED"].includes(r.status));
  const committedSpend = purchaseOrders.filter((po) => !["DRAFT", "CANCELLED", "ARCHIVED"].includes(po.status)).reduce((sum, po) => sum + po.amountMinor, 0);
  const dueDeliveries = deliveries.filter((d) => d.expectedAt && d.expectedAt >= now && d.expectedAt <= inSevenDays && !["ACCEPTED", "REJECTED", "CLOSED"].includes(d.status));
  const delayedDeliveries = deliveries.filter((d) => d.status === "DELAYED" || (d.expectedAt && d.expectedAt < now && !["ARRIVED", "ACCEPTED", "REJECTED", "CLOSED"].includes(d.status)));
  const openRfqs = rfqs.filter((r) => !["AWARDED", "CLOSED", "CANCELLED", "ARCHIVED"].includes(r.status));
  const invitationCount = rfqs.reduce((sum, r) => sum + r._count.suppliers, 0);
  const responseCount = rfqs.reduce((sum, r) => sum + r._count.quotations, 0);

  return {
    totalSuppliers: suppliers.length,
    qualifiedSuppliers: suppliers.filter((s) => ["QUALIFIED", "PREFERRED"].includes(s.status)).length,
    openRequestsCount: openRequests.length,
    overdueRequestsCount: openRequests.filter((r) => r.requiredBy && r.requiredBy < now).length,
    openRfqsCount: openRfqs.length,
    responseRate: invitationCount ? Math.round((responseCount / invitationCount) * 100) : 0,
    openOrdersCount: openOrders.length,
    pendingApprovalCount: purchaseOrders.filter((po) => po.status === "DRAFT").length,
    committedSpend,
    dueDeliveriesCount: dueDeliveries.length,
    delayedDeliveriesCount: delayedDeliveries.length,
    recentOrders: purchaseOrders.slice(0, 5),
    recentSuppliers: suppliers.slice(0, 5),
    recentRequests: requests.slice(0, 5),
    recentActivity: activity,
  };
}

export async function getProcurementWorkspace(tenantId: string) {
  const [requests, rfqs, orders, deliveries] = await Promise.all([
    db.purchaseRequest.findMany({ where: { tenantId, archivedAt: null }, include: { project: true }, orderBy: { requiredBy: "asc" } }),
    db.procurementRfq.findMany({ where: { tenantId }, include: { project: true, _count: { select: { suppliers: true, quotations: true } } }, orderBy: { deadline: "asc" } }),
    db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null }, include: { project: true, supplier: true }, orderBy: { requestedDeliveryDate: "asc" } }),
    db.procurementDelivery.findMany({ where: { tenantId }, include: { project: true, supplier: true, purchaseOrder: true }, orderBy: { expectedAt: "asc" } }),
  ]);
  return { requests, rfqs, orders, deliveries };
}

export async function listSuppliers(tenantId: string) {
  return db.supplier.findMany({
    where: { tenantId, archivedAt: null },
    include: { _count: { select: { purchaseOrders: true, quotations: true, riskFlags: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSupplier(tenantId: string, supplierId: string) {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      qualifications: { orderBy: { createdAt: "desc" } },
      riskFlags: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }] },
      categoryRef: true,
      quotations: { include: { rfq: true }, orderBy: { createdAt: "desc" } },
      purchaseOrders: { include: { project: true }, orderBy: { createdAt: "desc" } },
      deliveries: { include: { purchaseOrder: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const result = assertTenant(supplier, tenantId, "Supplier");
  return { ...result, documents: result.documents.map((d) => ({ ...d, status: d.status === "RENEWAL_REQUIRED" ? d.status : deriveDocumentStatus(d.expiresAt) })) };
}

export async function createSupplier(tenantId: string, actorId: string, input: {
  companyId?: string;
  name: string;
  legalName?: string;
  supplierType?: string;
  category: string;
  categoryId?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  countryCode?: string;
  address?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  notes?: string;
}) {
  if (input.companyId) await requireTenantCompany(tenantId, input.companyId);
  if (input.categoryId) assertTenant(await db.supplierCategory.findUnique({ where: { id: input.categoryId } }), tenantId, "SupplierCategory");
  const number = await allocateNumber(tenantId, "SUPPLIER");
  const supplier = await db.supplier.create({ data: { tenantId, number, ...input } });
  if (input.email || input.phone) {
    await db.supplierContact.create({ data: { tenantId, supplierId: supplier.id, name: input.name, role: "PRIMARY", email: input.email, phone: input.phone, isPrimary: true } });
  }
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER", entityId: supplier.id, eventType: "supplier.created", summary: `${number} created.` });
  return supplier;
}

export async function updateSupplierStatus(tenantId: string, actorId: string, supplierId: string, status: string, reason?: string) {
  const supplier = assertTenant(await db.supplier.findUnique({ where: { id: supplierId } }), tenantId, "Supplier");
  const allowed = ["PROSPECT", "UNDER_QUALIFICATION", "QUALIFIED", "PREFERRED", "SUSPENDED", "BLACKLISTED", "ARCHIVED"];
  if (!allowed.includes(status)) throw new Error("Invalid supplier status.");
  if (["SUSPENDED", "BLACKLISTED"].includes(status) && !reason?.trim()) throw new Error("A reason is required for this controlled supplier status.");
  await db.supplier.update({ where: { id: supplier.id }, data: { status, version: { increment: 1 }, archivedAt: status === "ARCHIVED" ? new Date() : undefined } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER", entityId: supplier.id, eventType: "supplier.status_changed", summary: reason || `Supplier moved to ${status}.`, previousStatus: supplier.status, nextStatus: status });
}

export async function addSupplierQualification(tenantId: string, actorId: string, supplierId: string, input: { outcome: string; score?: number; category?: string; validUntil?: Date; notes?: string }) {
  await requireTenantSupplier(tenantId, supplierId);
  const qualification = await db.supplierQualification.create({ data: { tenantId, supplierId, ...input } });
  const status = input.outcome === "QUALIFIED" ? "QUALIFIED" : input.outcome === "SUSPENDED" ? "SUSPENDED" : "UNDER_QUALIFICATION";
  await db.supplier.update({ where: { id: supplierId }, data: { qualificationStatus: input.outcome, overallScore: input.score, status, version: { increment: 1 } } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER", entityId: supplierId, eventType: "supplier.qualification_changed", summary: `Qualification recorded: ${input.outcome}.` });
  return qualification;
}

/**
 * Qualification records with an `expiring` flag resolved server-side. The
 * 30-day window is evaluated here, against a single instant, rather than per
 * row in the page — reading the clock during render is impure and would also
 * let rows disagree about "now".
 */
export async function listSupplierQualifications(tenantId: string) {
  const rows = await db.supplierQualification.findMany({
    where: { tenantId },
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  });
  const expiringBefore = new Date(Date.now() + 30 * 86400000);
  return rows.map((q) => ({ ...q, expiring: Boolean(q.validUntil && q.validUntil < expiringBefore) }));
}

// PRD Procurement §27.2 Phase 1 "Foundation" — dedicated category taxonomy.
export async function listSupplierCategories(tenantId: string) {
  return db.supplierCategory.findMany({ where: { tenantId }, include: { parent: true, _count: { select: { suppliers: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
}

export async function createSupplierCategory(tenantId: string, actorId: string, input: { companyId?: string; code: string; name: string; description?: string; parentId?: string }) {
  if (input.companyId) await requireTenantCompany(tenantId, input.companyId);
  if (input.parentId) assertTenant(await db.supplierCategory.findUnique({ where: { id: input.parentId } }), tenantId, "SupplierCategory");
  const category = await db.supplierCategory.create({ data: { tenantId, createdById: actorId, ...input } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER_CATEGORY", entityId: category.id, eventType: "supplier_category.created", summary: `${category.name} category created.` });
  return category;
}

export async function setSupplierCategoryActive(tenantId: string, actorId: string, categoryId: string, active: boolean) {
  const category = assertTenant(await db.supplierCategory.findUnique({ where: { id: categoryId } }), tenantId, "SupplierCategory");
  await db.supplierCategory.update({ where: { id: category.id }, data: { active } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER_CATEGORY", entityId: category.id, eventType: active ? "supplier_category.activated" : "supplier_category.deactivated", summary: `${category.name} ${active ? "activated" : "deactivated"}.` });
}

// PRD Procurement §27.2 Phase 1 "Foundation" — supplier documents and renewal.
export async function listSupplierDocuments(tenantId: string) {
  const rows = await db.supplierDocument.findMany({ where: { tenantId }, include: { supplier: true }, orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }] });
  return rows.map((d) => ({ ...d, status: d.status === "RENEWAL_REQUIRED" ? d.status : deriveDocumentStatus(d.expiresAt) }));
}

export async function addSupplierDocument(tenantId: string, actorId: string, supplierId: string, input: { type?: string; title: string; documentId?: string; url?: string; issuedAt?: Date; expiresAt?: Date; notes?: string }) {
  await requireTenantSupplier(tenantId, supplierId);
  const status = deriveDocumentStatus(input.expiresAt);
  const document = await db.supplierDocument.create({ data: { tenantId, supplierId, createdById: actorId, status, ...input } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER", entityId: supplierId, eventType: "supplier.document_added", summary: `${document.title} attached.` });
  return document;
}

export async function markSupplierDocumentRenewalRequired(tenantId: string, actorId: string, documentId: string, note?: string) {
  const document = assertTenant(await db.supplierDocument.findUnique({ where: { id: documentId } }), tenantId, "SupplierDocument");
  await db.supplierDocument.update({ where: { id: document.id }, data: { status: "RENEWAL_REQUIRED", notes: note ? `${document.notes ?? ""}\n${note}`.trim() : document.notes } });
  await writeActivity({ tenantId, actorId, entityType: "SUPPLIER", entityId: document.supplierId, eventType: "supplier.document_renewal_flagged", summary: `${document.title} flagged for renewal.` });
}

export async function listPurchaseRequests(tenantId: string) {
  return db.purchaseRequest.findMany({ where: { tenantId, archivedAt: null }, include: { project: true, createdBy: true, lines: true, package: true }, orderBy: { createdAt: "desc" } });
}

export async function getPurchaseRequest(tenantId: string, requestId: string) {
  const request = await db.purchaseRequest.findUnique({
    where: { id: requestId },
    include: { project: true, company: true, createdBy: true, lines: { orderBy: { lineNumber: "asc" } }, package: true, rfqs: true, purchaseOrders: { include: { supplier: true } } },
  });
  return assertTenant(request, tenantId, "PurchaseRequest");
}

export async function createPurchaseRequest(tenantId: string, actorId: string, input: {
  companyId: string;
  projectId?: string;
  title: string;
  type: string;
  priority?: string;
  justification?: string;
  requiredBy?: Date;
  deliveryLocation?: string;
  department?: string;
  category?: string;
  currency?: string;
  emergencyReason?: string;
  riskStatement?: string;
  lines: { lineType: string; description: string; specification?: string; quantity: number; unit: string; estimatedUnitCost: number; requiredBy?: Date; deliveryLocation?: string }[];
}) {
  await Promise.all([requireTenantCompany(tenantId, input.companyId), input.projectId ? requireTenantProject(tenantId, input.projectId) : null]);
  if (!input.lines.length) throw new Error("Add at least one request line.");
  if (input.type === "EMERGENCY_PURCHASE" && (!input.emergencyReason || !input.riskStatement)) throw new Error("Emergency requests require a reason and risk statement.");
  const number = await allocateNumber(tenantId, "PURCHASE_REQUEST");
  const estimatedAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.estimatedUnitCost, 0);
  const request = await db.purchaseRequest.create({
    data: {
      tenantId, companyId: input.companyId, projectId: input.projectId, number, title: input.title, type: input.type,
      priority: input.priority ?? "NORMAL", justification: input.justification, requiredBy: input.requiredBy,
      deliveryLocation: input.deliveryLocation, department: input.department, category: input.category,
      estimatedAmount, currency: input.currency ?? "EUR", emergencyReason: input.emergencyReason,
      riskStatement: input.riskStatement, createdById: actorId,
      lines: { create: input.lines.map((line, index) => ({ tenantId, lineNumber: index + 1, ...line })) },
    },
  });
  await writeActivity({ tenantId, actorId, entityType: "PURCHASE_REQUEST", entityId: request.id, eventType: "purchase_request.created", summary: `${number} created with ${input.lines.length} line(s).` });
  return request;
}

export async function transitionPurchaseRequest(tenantId: string, actorId: string, requestId: string, nextStatus: string, reason?: string) {
  const request = assertTenant(await db.purchaseRequest.findUnique({ where: { id: requestId }, include: { lines: true } }), tenantId, "PurchaseRequest");
  if (!isProcurementTransitionAllowed("purchaseRequest", request.status, nextStatus)) throw new Error(`Cannot move a request from ${request.status} to ${nextStatus}.`);
  const snapshot = nextStatus === "SUBMITTED" ? JSON.stringify({ ...request, lines: request.lines, submittedAt: new Date().toISOString() }) : undefined;
  await db.purchaseRequest.update({ where: { id: request.id }, data: { status: nextStatus, snapshot, version: { increment: 1 } } });
  await writeActivity({ tenantId, actorId, entityType: "PURCHASE_REQUEST", entityId: request.id, eventType: `purchase_request.${nextStatus.toLowerCase()}`, summary: reason || `Request moved to ${nextStatus}.`, previousStatus: request.status, nextStatus });
  // Phase 1 Track B — procurement approvals had no AuditEvent. This is the
  // committing step for a purchase request, so it is the one recorded here.
  await logAudit({ tenantId, actorId, action: `procurement.request.${nextStatus.toLowerCase()}`, targetType: "PurchaseRequest", targetId: request.id,
    metadata: { from: request.status, to: nextStatus, reason: reason ?? null } });
}

export async function listProcurementPackages(tenantId: string) {
  return db.procurementPackage.findMany({ where: { tenantId }, include: { project: true, _count: { select: { requests: true, rfqs: true, purchaseOrders: true } } }, orderBy: { createdAt: "desc" } });
}

export async function createProcurementPackage(tenantId: string, actorId: string, input: { companyId: string; projectId?: string; name: string; type?: string; scope?: string; targetValue?: number; currency?: string; awardTarget?: Date; riskLevel?: string }) {
  await Promise.all([requireTenantCompany(tenantId, input.companyId), input.projectId ? requireTenantProject(tenantId, input.projectId) : null]);
  const number = await allocateNumber(tenantId, "PROCUREMENT_PACKAGE");
  const pkg = await db.procurementPackage.create({ data: { tenantId, createdById: actorId, number, ...input } });
  await writeActivity({ tenantId, actorId, entityType: "PROCUREMENT_PACKAGE", entityId: pkg.id, eventType: "procurement_package.created", summary: `${number} created.` });
  return pkg;
}

export async function listRfqs(tenantId: string) {
  return db.procurementRfq.findMany({ where: { tenantId }, include: { project: true, package: true, createdBy: true, suppliers: { include: { supplier: true } }, quotations: { include: { supplier: true } }, lines: true }, orderBy: { createdAt: "desc" } });
}

export async function getRfq(tenantId: string, rfqId: string) {
  const rfq = await db.procurementRfq.findUnique({ where: { id: rfqId }, include: { project: true, package: true, request: true, createdBy: true, lines: { orderBy: { lineNumber: "asc" } }, suppliers: { include: { supplier: true } }, quotations: { include: { supplier: true, lines: true } }, purchaseOrders: { include: { supplier: true } } } });
  return assertTenant(rfq, tenantId, "ProcurementRfq");
}

export async function createRfq(tenantId: string, actorId: string, input: { companyId: string; projectId?: string; requestId?: string; packageId?: string; title: string; type?: string; deadline?: Date; instructions?: string; supplierIds: string[]; lines: { description: string; quantity: number; unit: string; requiredBy?: Date }[] }) {
  await Promise.all([requireTenantCompany(tenantId, input.companyId), input.projectId ? requireTenantProject(tenantId, input.projectId) : null, requireTenantRecord("purchaseRequest", tenantId, input.requestId), requireTenantRecord("procurementPackage", tenantId, input.packageId), ...input.supplierIds.map((id) => requireTenantSupplier(tenantId, id))]);
  if (!input.lines.length) throw new Error("Add at least one RFQ line.");
  const number = await allocateNumber(tenantId, "PROCUREMENT_RFQ");
  const rfq = await db.procurementRfq.create({ data: { tenantId, companyId: input.companyId, projectId: input.projectId, requestId: input.requestId, packageId: input.packageId, number, title: input.title, type: input.type ?? "RFQ", deadline: input.deadline, instructions: input.instructions, createdById: actorId, lines: { create: input.lines.map((line, index) => ({ tenantId, lineNumber: index + 1, ...line })) }, suppliers: { create: input.supplierIds.map((supplierId) => ({ tenantId, supplierId })) } } });
  await writeActivity({ tenantId, actorId, entityType: "RFQ", entityId: rfq.id, eventType: "rfq.created", summary: `${number} created.` });
  return rfq;
}

export async function transitionRfq(tenantId: string, actorId: string, rfqId: string, nextStatus: string) {
  const rfq = assertTenant(await db.procurementRfq.findUnique({ where: { id: rfqId }, include: { lines: true, suppliers: true } }), tenantId, "ProcurementRfq");
  if (!isProcurementTransitionAllowed("rfq", rfq.status, nextStatus)) throw new Error(`Cannot move an RFQ from ${rfq.status} to ${nextStatus}.`);
  if (nextStatus === "ISSUED" && (!rfq.deadline || !rfq.lines.length || !rfq.suppliers.length)) throw new Error("An RFQ needs a deadline, at least one line and at least one supplier before issue.");
  const issuedSnapshot = nextStatus === "ISSUED" ? JSON.stringify({ ...rfq, issuedAt: new Date().toISOString() }) : undefined;
  await db.$transaction([db.procurementRfq.update({ where: { id: rfq.id }, data: { status: nextStatus, issuedSnapshot, version: { increment: 1 } } }), ...(nextStatus === "ISSUED" ? [db.procurementRfqSupplier.updateMany({ where: { rfqId: rfq.id }, data: { status: "INVITED", invitedAt: new Date() } })] : [])]);
  await writeActivity({ tenantId, actorId, entityType: "RFQ", entityId: rfq.id, eventType: `rfq.${nextStatus.toLowerCase()}`, summary: `RFQ moved to ${nextStatus}.`, previousStatus: rfq.status, nextStatus });
}

export async function createQuotation(tenantId: string, actorId: string, input: { companyId: string; projectId?: string; rfqId: string; supplierId: string; supplierReference?: string; currency?: string; discount?: number; tax?: number; freight?: number; validityDate?: Date; leadTimeDays?: number; paymentTerms?: string; notes?: string; lines: { rfqLineId?: string; description: string; quantity: number; unit: string; unitPrice: number; compliance?: string; leadTimeDays?: number }[] }) {
  const rfq = assertTenant(await db.procurementRfq.findUnique({ where: { id: input.rfqId }, include: { suppliers: true } }), tenantId, "ProcurementRfq");
  if (!rfq.suppliers.some((s) => s.supplierId === input.supplierId)) throw new Error("This supplier was not invited to the RFQ.");
  const number = await allocateNumber(tenantId, "SUPPLIER_QUOTATION");
  // Phase 15 — totals computed in integer minor units. quantity stays a real
  // measured value, so each line is rounded to the nearest cent once, here,
  // rather than accumulating float error across the sum.
  const currency = input.currency ?? "EUR";
  const lineTotalsMinor = input.lines.map((line) => Math.round(line.quantity * toMinorUnits(line.unitPrice, currency)));
  const subtotalMinor = sumMinor(lineTotalsMinor);
  const discountMinor = toMinorUnits(input.discount ?? 0, currency);
  const taxMinor = toMinorUnits(input.tax ?? 0, currency);
  const freightMinor = toMinorUnits(input.freight ?? 0, currency);
  const totalMinor = subtotalMinor - discountMinor + taxMinor + freightMinor;
  const quotation = await db.supplierQuotation.create({ data: { tenantId, companyId: input.companyId, projectId: input.projectId, rfqId: input.rfqId, supplierId: input.supplierId, number, supplierReference: input.supplierReference, currency, subtotalMinor, discountMinor, taxMinor, freightMinor, totalMinor, validityDate: input.validityDate, leadTimeDays: input.leadTimeDays, paymentTerms: input.paymentTerms, notes: input.notes, createdById: actorId, lines: { create: input.lines.map((line, i) => ({ tenantId, ...line, unitPriceMinor: toMinorUnits(line.unitPrice, currency), unitPrice: undefined, lineTotalMinor: lineTotalsMinor[i] })) } } });
  await db.procurementRfqSupplier.updateMany({ where: { rfqId: input.rfqId, supplierId: input.supplierId }, data: { status: "RESPONSE_RECEIVED", respondedAt: new Date() } });
  await writeActivity({ tenantId, actorId, entityType: "QUOTATION", entityId: quotation.id, eventType: "quotation.received", summary: `${number} received.` });
  return quotation;
}

export async function listPurchaseOrders(tenantId: string) {
  return db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null }, include: { supplier: true, project: true, requestedBy: true, lines: true, deliveries: true }, orderBy: { createdAt: "desc" } });
}

export async function getPurchaseOrder(tenantId: string, purchaseOrderId: string) {
  const order = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { supplier: true, project: true, requestedBy: true, request: true, package: true, rfq: true, quotation: true, lines: { orderBy: { lineNumber: "asc" } }, revisions: { orderBy: { version: "desc" } }, deliveries: { orderBy: { createdAt: "desc" } } } });
  return assertTenant(order, tenantId, "PurchaseOrder");
}

export async function createPurchaseOrder(tenantId: string, requestedById: string, input: { companyId?: string; supplierId: string; projectId?: string; requestId?: string; packageId?: string; rfqId?: string; quotationId?: string; awardRecommendationId?: string; title?: string; description: string; amount?: number; currency?: string; requestedDeliveryDate?: Date; deliveryAddress?: string; paymentTerms?: string; lines?: { lineType: string; description: string; quantity: number; unit: string; unitPrice: number; discount?: number; tax?: number; promisedDate?: Date }[] }) {
  await Promise.all([requireTenantSupplier(tenantId, input.supplierId), input.projectId ? requireTenantProject(tenantId, input.projectId) : null, input.companyId ? requireTenantCompany(tenantId, input.companyId) : null, requireTenantRecord("purchaseRequest", tenantId, input.requestId), requireTenantRecord("procurementPackage", tenantId, input.packageId), requireTenantRecord("procurementRfq", tenantId, input.rfqId), requireTenantRecord("supplierQuotation", tenantId, input.quotationId)]);
  if (input.awardRecommendationId) {
    const award = assertTenant(await db.awardRecommendation.findUnique({ where: { id: input.awardRecommendationId } }), tenantId, "AwardRecommendation");
    if (award.status !== "APPROVED") throw new Error("A purchase order can only be created from an approved award recommendation.");
  }
  const lines = input.lines ?? [];
  const poCurrency = input.currency ?? "EUR";
  const totals = lines.length
    ? calculateProcurementTotalsMinor(lines, poCurrency)
    : (() => {
        const flat = toMinorUnits(input.amount ?? 0, poCurrency);
        return { lineTotalsMinor: [] as number[], subtotalMinor: flat, discountMinor: 0, taxMinor: 0, freightMinor: 0, totalMinor: flat };
      })();
  const { subtotalMinor, discountMinor, taxMinor, totalMinor: amountMinor, lineTotalsMinor } = totals;
  const number = await allocateNumber(tenantId, "PURCHASE_ORDER");
  const order = await db.purchaseOrder.create({ data: { tenantId, number, requestedById, companyId: input.companyId, supplierId: input.supplierId, projectId: input.projectId, requestId: input.requestId, packageId: input.packageId, rfqId: input.rfqId, quotationId: input.quotationId, awardRecommendationId: input.awardRecommendationId, title: input.title, description: input.description, amountMinor, subtotalMinor, discountMinor, taxMinor, currency: poCurrency, requestedDeliveryDate: input.requestedDeliveryDate, deliveryAddress: input.deliveryAddress, paymentTerms: input.paymentTerms, lines: lines.length ? { create: lines.map((line, index) => ({ tenantId, lineNumber: index + 1, ...line, unitPrice: undefined, unitPriceMinor: toMinorUnits(line.unitPrice, poCurrency), discountMinor: toMinorUnits(line.discount ?? 0, poCurrency), taxMinor: toMinorUnits(line.tax ?? 0, poCurrency), discount: undefined, tax: undefined, lineTotalMinor: lineTotalsMinor[index] - toMinorUnits(line.discount ?? 0, poCurrency) + toMinorUnits(line.tax ?? 0, poCurrency) })) } : undefined } });
  await writeActivity({ tenantId, actorId: requestedById, entityType: "PURCHASE_ORDER", entityId: order.id, eventType: "purchase_order.created", summary: `${number} created.` });
  return order;
}

export async function updatePurchaseOrderStatus(tenantId: string, actorId: string, purchaseOrderId: string, status: string, reason?: string) {
  const po = assertTenant(await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { lines: true } }), tenantId, "PurchaseOrder");
  const legacyTransitions: Record<string, string[]> = { SUBMITTED: ["ISSUED", "CANCELLED"], APPROVED: ["ISSUED", "CANCELLED"], ORDERED: ["ACKNOWLEDGED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"], RECEIVED: ["CLOSED"] };
  if (!isProcurementTransitionAllowed("purchaseOrder", po.status, status) && !(legacyTransitions[po.status] ?? []).includes(status)) throw new Error(`Cannot move a purchase order from ${po.status} to ${status}.`);
  if (status === "ISSUED" && po.amountMinor <= 0) throw new Error("Purchase order total must be greater than zero before issue.");
  const issuedSnapshot = status === "ISSUED" ? JSON.stringify({ ...po, issuedAt: new Date().toISOString() }) : undefined;
  await db.purchaseOrder.update({ where: { id: po.id }, data: { status, issueDate: status === "ISSUED" ? new Date() : undefined, acknowledgedAt: status === "ACKNOWLEDGED" ? new Date() : undefined, issuedSnapshot, version: { increment: 1 } } });
  await writeActivity({ tenantId, actorId, entityType: "PURCHASE_ORDER", entityId: po.id, eventType: `purchase_order.${status.toLowerCase()}`, summary: reason || `Purchase order moved to ${status}.`, previousStatus: po.status, nextStatus: status });
}

export async function listDeliveries(tenantId: string) {
  return db.procurementDelivery.findMany({ where: { tenantId }, include: { supplier: true, project: true, purchaseOrder: true, lines: true, createdBy: true }, orderBy: [{ expectedAt: "asc" }, { createdAt: "desc" }] });
}

export async function createDelivery(tenantId: string, actorId: string, input: { companyId: string; purchaseOrderId: string; expectedAt?: Date; deliveryLocation?: string; carrierReference?: string }) {
  const po = assertTenant(await db.purchaseOrder.findUnique({ where: { id: input.purchaseOrderId }, include: { lines: true } }), tenantId, "PurchaseOrder");
  if (["DRAFT", "CANCELLED", "ARCHIVED"].includes(po.status)) throw new Error("Only an active issued purchase order can receive a delivery schedule.");
  const number = await allocateNumber(tenantId, "PROCUREMENT_DELIVERY");
  const delivery = await db.procurementDelivery.create({ data: { tenantId, companyId: input.companyId, projectId: po.projectId, purchaseOrderId: po.id, supplierId: po.supplierId, number, expectedAt: input.expectedAt, deliveryLocation: input.deliveryLocation, carrierReference: input.carrierReference, createdById: actorId, lines: po.lines.length ? { create: po.lines.map((line) => ({ tenantId, purchaseOrderLineId: line.id, scheduledQuantity: Math.max(0, line.quantity - line.deliveredQuantity) })) } : undefined } });
  await writeActivity({ tenantId, actorId, entityType: "DELIVERY", entityId: delivery.id, eventType: "delivery.scheduled", summary: `${number} scheduled for ${po.number}.` });
  return delivery;
}

export async function updateDeliveryStatus(tenantId: string, actorId: string, deliveryId: string, status: string, input?: { exceptionType?: string; exceptionNote?: string }) {
  const delivery = assertTenant(await db.procurementDelivery.findUnique({ where: { id: deliveryId } }), tenantId, "ProcurementDelivery");
  const allowed = ["PLANNED", "CONFIRMED", "DISPATCHED", "IN_TRANSIT", "DELAYED", "ARRIVED", "PARTIALLY_ACCEPTED", "ACCEPTED", "REJECTED", "CLOSED"];
  if (!allowed.includes(status)) throw new Error("Invalid delivery status.");
  if (["DELAYED", "REJECTED"].includes(status) && !input?.exceptionType) throw new Error("Select an exception type for delayed or rejected deliveries.");
  await db.procurementDelivery.update({ where: { id: delivery.id }, data: { status, actualArrival: status === "ARRIVED" ? new Date() : undefined, exceptionType: input?.exceptionType, exceptionNote: input?.exceptionNote } });
  await writeActivity({ tenantId, actorId, entityType: "DELIVERY", entityId: delivery.id, eventType: `delivery.${status.toLowerCase()}`, summary: input?.exceptionNote || `Delivery moved to ${status}.`, previousStatus: delivery.status, nextStatus: status });
}

export async function listProcurementActivity(tenantId: string, entityType: string, entityId: string) {
  return db.procurementActivity.findMany({ where: { tenantId, entityType, entityId }, include: { actor: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } });
}
