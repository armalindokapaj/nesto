"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import {
  addSupplierQualification,
  createDelivery,
  createProcurementPackage,
  createPurchaseOrder,
  createPurchaseRequest,
  createQuotation,
  createRfq,
  createSupplier,
  transitionPurchaseRequest,
  transitionRfq,
  updateDeliveryStatus,
  updatePurchaseOrderStatus,
  updateSupplierStatus,
} from "@/server/procurement";

export type ProcurementActionState = { error?: string; success?: string } | undefined;

async function procurementContext(configKey?: string) {
  const current = await getCurrentUser();
  if (!can(current.role, "PROCUREMENT", "WRITE")) throw new Error("You do not have permission to manage procurement.");
  if (configKey) await assertConfigEnabled(current.tenantId, configKey, current.company?.id);
  return current;
}

function actionError(error: unknown, fallback: string): ProcurementActionState {
  return { error: error instanceof Error ? error.message : fallback };
}

const CreateSupplierSchema = z.object({
  name: z.string().trim().min(2, "Enter a supplier name"),
  legalName: z.string().trim().optional(),
  supplierType: z.string().trim().default("MATERIALS"),
  category: z.string().trim().min(2, "Enter a category"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  countryCode: z.string().length(2).default("AL"),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function createSupplierAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext("procurement.action.create_supplier");
    const parsed = CreateSupplierSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    await createSupplier(tenantId, user.id, { ...parsed.data, companyId: company?.id, email: parsed.data.email || undefined });
    revalidatePath("/dashboard/procurement");
    revalidatePath("/dashboard/procurement/suppliers");
    return { success: "Supplier created." };
  } catch (error) {
    return actionError(error, "Could not create supplier.");
  }
}

export async function updateSupplierStatusAction(supplierId: string, status: string, reason?: string) {
  const { tenantId, user } = await procurementContext();
  await updateSupplierStatus(tenantId, user.id, supplierId, status, reason);
  revalidatePath("/dashboard/procurement/suppliers");
  revalidatePath(`/dashboard/procurement/suppliers/${supplierId}`);
}

export async function addSupplierQualificationAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user } = await procurementContext();
    const parsed = z.object({ supplierId: z.string().min(1), outcome: z.string().min(1), score: z.coerce.number().min(0).max(100).optional(), category: z.string().optional(), validUntil: z.coerce.date().optional(), notes: z.string().optional() }).safeParse({ supplierId: formData.get("supplierId"), outcome: formData.get("outcome"), score: formData.get("score") || undefined, category: formData.get("category") || undefined, validUntil: formData.get("validUntil") || undefined, notes: formData.get("notes") || undefined });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid qualification" };
    const { supplierId, ...input } = parsed.data;
    await addSupplierQualification(tenantId, user.id, supplierId, input);
    revalidatePath(`/dashboard/procurement/suppliers/${supplierId}`);
    return { success: "Qualification recorded." };
  } catch (error) {
    return actionError(error, "Could not record qualification.");
  }
}

export async function createPurchaseRequestAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext("procurement.action.create_request");
    if (!company) return { error: "No active company found." };
    const parsed = z.object({
      projectId: z.string().optional(), title: z.string().trim().min(2), type: z.string().min(1), priority: z.string().default("NORMAL"),
      justification: z.string().optional(), requiredBy: z.coerce.date().optional(), deliveryLocation: z.string().optional(), category: z.string().optional(),
      emergencyReason: z.string().optional(), riskStatement: z.string().optional(), lineType: z.string().default("MATERIAL"),
      description: z.string().trim().min(2, "Describe the requested item or service"), quantity: z.coerce.number().positive(), unit: z.string().trim().min(1), estimatedUnitCost: z.coerce.number().min(0),
    }).safeParse({ projectId: formData.get("projectId") || undefined, title: formData.get("title"), type: formData.get("type"), priority: formData.get("priority"), justification: formData.get("justification") || undefined, requiredBy: formData.get("requiredBy") || undefined, deliveryLocation: formData.get("deliveryLocation") || undefined, category: formData.get("category") || undefined, emergencyReason: formData.get("emergencyReason") || undefined, riskStatement: formData.get("riskStatement") || undefined, lineType: formData.get("lineType"), description: formData.get("description"), quantity: formData.get("quantity"), unit: formData.get("unit"), estimatedUnitCost: formData.get("estimatedUnitCost") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
    const { lineType, description, quantity, unit, estimatedUnitCost, ...header } = parsed.data;
    await createPurchaseRequest(tenantId, user.id, { companyId: company.id, ...header, lines: [{ lineType, description, quantity, unit, estimatedUnitCost, requiredBy: header.requiredBy, deliveryLocation: header.deliveryLocation }] });
    revalidatePath("/dashboard/procurement");
    revalidatePath("/dashboard/procurement/requests");
    revalidatePath("/dashboard/procurement/workspace");
    return { success: "Purchase request created." };
  } catch (error) {
    return actionError(error, "Could not create purchase request.");
  }
}

export async function transitionPurchaseRequestAction(requestId: string, nextStatus: string, reason?: string) {
  const { tenantId, user } = await procurementContext();
  await transitionPurchaseRequest(tenantId, user.id, requestId, nextStatus, reason);
  revalidatePath("/dashboard/procurement/requests");
  revalidatePath(`/dashboard/procurement/requests/${requestId}`);
  revalidatePath("/dashboard/procurement/workspace");
}

export async function createProcurementPackageAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext();
    if (!company) return { error: "No active company found." };
    const parsed = z.object({ projectId: z.string().optional(), name: z.string().min(2), type: z.string().default("PROJECT_PACKAGE"), scope: z.string().optional(), targetValue: z.coerce.number().min(0).optional(), awardTarget: z.coerce.date().optional(), riskLevel: z.string().default("LOW") }).safeParse({ projectId: formData.get("projectId") || undefined, name: formData.get("name"), type: formData.get("type"), scope: formData.get("scope") || undefined, targetValue: formData.get("targetValue") || undefined, awardTarget: formData.get("awardTarget") || undefined, riskLevel: formData.get("riskLevel") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid package" };
    await createProcurementPackage(tenantId, user.id, { companyId: company.id, ...parsed.data });
    revalidatePath("/dashboard/procurement/packages");
    return { success: "Procurement package created." };
  } catch (error) {
    return actionError(error, "Could not create package.");
  }
}

export async function createRfqAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext();
    if (!company) return { error: "No active company found." };
    const parsed = z.object({ projectId: z.string().optional(), requestId: z.string().optional(), packageId: z.string().optional(), title: z.string().min(2), type: z.string().default("RFQ"), deadline: z.coerce.date(), instructions: z.string().optional(), supplierId: z.string().min(1), description: z.string().min(2), quantity: z.coerce.number().positive(), unit: z.string().min(1) }).safeParse({ projectId: formData.get("projectId") || undefined, requestId: formData.get("requestId") || undefined, packageId: formData.get("packageId") || undefined, title: formData.get("title"), type: formData.get("type"), deadline: formData.get("deadline"), instructions: formData.get("instructions") || undefined, supplierId: formData.get("supplierId"), description: formData.get("description"), quantity: formData.get("quantity"), unit: formData.get("unit") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid RFQ" };
    const { supplierId, description, quantity, unit, ...header } = parsed.data;
    await createRfq(tenantId, user.id, { companyId: company.id, ...header, supplierIds: [supplierId], lines: [{ description, quantity, unit }] });
    revalidatePath("/dashboard/procurement/sourcing");
    revalidatePath("/dashboard/procurement/workspace");
    return { success: "RFQ created." };
  } catch (error) {
    return actionError(error, "Could not create RFQ.");
  }
}

export async function transitionRfqAction(rfqId: string, nextStatus: string) {
  const { tenantId, user } = await procurementContext(nextStatus === "ISSUED" ? "procurement.action.issue_rfq" : undefined);
  await transitionRfq(tenantId, user.id, rfqId, nextStatus);
  revalidatePath("/dashboard/procurement/sourcing");
  revalidatePath(`/dashboard/procurement/sourcing/${rfqId}`);
  revalidatePath("/dashboard/procurement/workspace");
}

export async function createQuotationAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext();
    if (!company) return { error: "No active company found." };
    const parsed = z.object({ rfqId: z.string().min(1), supplierId: z.string().min(1), projectId: z.string().optional(), supplierReference: z.string().optional(), currency: z.string().default("EUR"), discount: z.coerce.number().min(0).default(0), tax: z.coerce.number().min(0).default(0), freight: z.coerce.number().min(0).default(0), validityDate: z.coerce.date().optional(), leadTimeDays: z.coerce.number().int().min(0).optional(), paymentTerms: z.string().optional(), description: z.string().min(2), quantity: z.coerce.number().positive(), unit: z.string().min(1), unitPrice: z.coerce.number().min(0) }).safeParse({ rfqId: formData.get("rfqId"), supplierId: formData.get("supplierId"), projectId: formData.get("projectId") || undefined, supplierReference: formData.get("supplierReference") || undefined, currency: formData.get("currency") || "EUR", discount: formData.get("discount") || 0, tax: formData.get("tax") || 0, freight: formData.get("freight") || 0, validityDate: formData.get("validityDate") || undefined, leadTimeDays: formData.get("leadTimeDays") || undefined, paymentTerms: formData.get("paymentTerms") || undefined, description: formData.get("description"), quantity: formData.get("quantity"), unit: formData.get("unit"), unitPrice: formData.get("unitPrice") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid quotation" };
    const { description, quantity, unit, unitPrice, ...header } = parsed.data;
    await createQuotation(tenantId, user.id, { companyId: company.id, ...header, lines: [{ description, quantity, unit, unitPrice }] });
    revalidatePath(`/dashboard/procurement/sourcing/${parsed.data.rfqId}`);
    revalidatePath("/dashboard/procurement/sourcing");
    return { success: "Quotation recorded." };
  } catch (error) {
    return actionError(error, "Could not record quotation.");
  }
}

export async function createPurchaseOrderAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext();
    const parsed = z.object({ supplierId: z.string().min(1), projectId: z.string().optional(), requestId: z.string().optional(), rfqId: z.string().optional(), quotationId: z.string().optional(), title: z.string().optional(), description: z.string().min(2), lineType: z.string().default("MATERIAL"), quantity: z.coerce.number().positive(), unit: z.string().min(1), unitPrice: z.coerce.number().min(0), requestedDeliveryDate: z.coerce.date().optional(), deliveryAddress: z.string().optional(), paymentTerms: z.string().optional() }).safeParse({ supplierId: formData.get("supplierId"), projectId: formData.get("projectId") || undefined, requestId: formData.get("requestId") || undefined, rfqId: formData.get("rfqId") || undefined, quotationId: formData.get("quotationId") || undefined, title: formData.get("title") || undefined, description: formData.get("description"), lineType: formData.get("lineType") || "MATERIAL", quantity: formData.get("quantity") || 1, unit: formData.get("unit") || "item", unitPrice: formData.get("unitPrice") ?? formData.get("amount"), requestedDeliveryDate: formData.get("requestedDeliveryDate") || undefined, deliveryAddress: formData.get("deliveryAddress") || undefined, paymentTerms: formData.get("paymentTerms") || undefined });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order" };
    const { lineType, quantity, unit, unitPrice, ...header } = parsed.data;
    await createPurchaseOrder(tenantId, user.id, { companyId: company?.id, ...header, lines: [{ lineType, description: header.description, quantity, unit, unitPrice }] });
    revalidatePath("/dashboard/procurement/orders");
    revalidatePath("/dashboard/procurement");
    revalidatePath("/dashboard/procurement/workspace");
    return { success: "Purchase order created." };
  } catch (error) {
    return actionError(error, "Could not create purchase order.");
  }
}

export async function updatePurchaseOrderStatusAction(purchaseOrderId: string, status: string, reason?: string) {
  const { tenantId, user } = await procurementContext(status === "ISSUED" ? "procurement.action.issue_order" : undefined);
  await updatePurchaseOrderStatus(tenantId, user.id, purchaseOrderId, status, reason);
  revalidatePath("/dashboard/procurement/orders");
  revalidatePath(`/dashboard/procurement/orders/${purchaseOrderId}`);
  revalidatePath("/dashboard/procurement");
  revalidatePath("/dashboard/procurement/workspace");
}

export async function createDeliveryAction(_prev: ProcurementActionState, formData: FormData): Promise<ProcurementActionState> {
  try {
    const { tenantId, user, company } = await procurementContext("procurement.action.record_delivery");
    if (!company) return { error: "No active company found." };
    const parsed = z.object({ purchaseOrderId: z.string().min(1), expectedAt: z.coerce.date().optional(), deliveryLocation: z.string().optional(), carrierReference: z.string().optional() }).safeParse({ purchaseOrderId: formData.get("purchaseOrderId"), expectedAt: formData.get("expectedAt") || undefined, deliveryLocation: formData.get("deliveryLocation") || undefined, carrierReference: formData.get("carrierReference") || undefined });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid delivery" };
    await createDelivery(tenantId, user.id, { companyId: company.id, ...parsed.data });
    revalidatePath("/dashboard/procurement/deliveries");
    revalidatePath("/dashboard/procurement/workspace");
    return { success: "Delivery scheduled." };
  } catch (error) {
    return actionError(error, "Could not schedule delivery.");
  }
}

export async function updateDeliveryStatusAction(deliveryId: string, status: string, exceptionType?: string, exceptionNote?: string) {
  const { tenantId, user } = await procurementContext();
  await updateDeliveryStatus(tenantId, user.id, deliveryId, status, { exceptionType, exceptionNote });
  revalidatePath("/dashboard/procurement/deliveries");
  revalidatePath("/dashboard/procurement/workspace");
}
