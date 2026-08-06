import type { FixtureContext } from "./context";
import { createProductCategory, createUnitOfMeasure, createProduct, createWarehouse, createMovement, postMovement } from "@/server/inventory-module";
import { createPurchaseRequest, createProcurementPackage, createRfq, createQuotation, createPurchaseOrder, updatePurchaseOrderStatus, createDelivery } from "@/server/procurement";
import { createOpportunity, createLead } from "@/server/crm-module";

export async function seedProcurementInventoryCrm(ctx: FixtureContext) {
  const { db, tenantId, companyId, owner, users, projects } = ctx;
  console.log("Procurement pipeline, Inventory, CRM…");

  // --- Procurement: full request -> package -> RFQ -> quotation -> PO -> delivery pipeline ---
  if (!(await db.purchaseRequest.findFirst({ where: { tenantId } }))) {
    const request = await createPurchaseRequest(tenantId, owner.id, {
      companyId,
      projectId: projects.metroMall.id,
      title: "MEP rough-in materials — Level 3",
      type: "STANDARD",
      priority: "HIGH",
      justification: "Level 3 MEP coordination set approved; materials needed to hold schedule.",
      currency: "EUR",
      lines: [{ lineType: "MATERIAL", description: "Galvanized conduit, 25mm", quantity: 400, unit: "m", estimatedUnitCost: 3.2 }],
    });
    console.log("  + PurchaseRequest: MEP rough-in materials");

    const pkg = await createProcurementPackage(tenantId, owner.id, { companyId, projectId: projects.metroMall.id, name: "MEP Electrical Package", type: "PACKAGE", targetValue: 30_000, currency: "EUR" });
    console.log("  + ProcurementPackage: MEP Electrical Package");

    const [steelworks, electroSupply] = await Promise.all([
      db.supplier.findFirst({ where: { tenantId, name: "SteelWorks Albania" } }),
      db.supplier.findFirst({ where: { tenantId, name: "ElectroSupply Tirana" } }),
    ]);

    if (electroSupply) {
      const rfq = await createRfq(tenantId, owner.id, {
        companyId,
        projectId: projects.metroMall.id,
        requestId: request.id,
        packageId: pkg.id,
        title: "RFQ — MEP electrical rough-in materials",
        supplierIds: [electroSupply.id],
        lines: [{ description: "Galvanized conduit, 25mm", quantity: 400, unit: "m" }],
      });
      console.log("  + RFQ sent to ElectroSupply Tirana");

      const quotation = await createQuotation(tenantId, owner.id, {
        companyId,
        projectId: projects.metroMall.id,
        rfqId: rfq.id,
        supplierId: electroSupply.id,
        currency: "EUR",
        leadTimeDays: 10,
        paymentTerms: "Net 30",
        lines: [{ description: "Galvanized conduit, 25mm", quantity: 400, unit: "m", unitPrice: 3.1 }],
      });
      console.log("  + Supplier quotation received");

      const po = await createPurchaseOrder(tenantId, owner.id, {
        companyId,
        supplierId: electroSupply.id,
        projectId: projects.metroMall.id,
        requestId: request.id,
        packageId: pkg.id,
        rfqId: rfq.id,
        quotationId: quotation.id,
        description: "MEP electrical rough-in materials — Level 3",
        currency: "EUR",
        lines: [{ lineType: "MATERIAL", description: "Galvanized conduit, 25mm", quantity: 400, unit: "m", unitPrice: 3.1 }],
      });
      await updatePurchaseOrderStatus(tenantId, owner.id, po.id, "ISSUED");
      console.log("  + PurchaseOrder issued from quotation");

      await createDelivery(tenantId, owner.id, { companyId, purchaseOrderId: po.id, expectedAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), deliveryLocation: "Metro Mall Site" });
      console.log("  + Delivery scheduled");
    }

    if (steelworks) {
      // A second RFQ/quotation on the existing structural-steel PO from the
      // main seed, so the Suppliers page shows more than one live pipeline.
      const existingPo = await db.purchaseOrder.findFirst({ where: { tenantId, supplierId: steelworks.id } });
      if (existingPo) {
        await createDelivery(tenantId, owner.id, { companyId, purchaseOrderId: existingPo.id, expectedAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), deliveryLocation: "Riverside Towers Site" });
        console.log("  + Delivery scheduled against the seeded structural-steel PO");
      }
    }
  }

  // --- Inventory ---------------------------------------------------------------
  if (!(await db.product.findFirst({ where: { tenantId } }))) {
    const category = await createProductCategory(tenantId, { code: "ELEC", name: "Electrical Materials" });
    const meter = await createUnitOfMeasure(tenantId, { name: "Meter", symbol: "m" });
    const each = await createUnitOfMeasure(tenantId, { name: "Each", symbol: "ea" });
    const product1 = await createProduct(tenantId, { sku: "COND-25MM", name: "Galvanized conduit, 25mm", categoryId: category.id, baseUomId: meter.id });
    const product2 = await createProduct(tenantId, { sku: "JBOX-STD", name: "Standard junction box", categoryId: category.id, baseUomId: each.id });
    console.log("  + Products: conduit, junction box");

    const siteWarehouse = await createWarehouse(tenantId, { code: "WH-SITE-MM", name: "Metro Mall Site Store", managerId: users.besnik.id });
    const hqWarehouse = await createWarehouse(tenantId, { code: "WH-HQ", name: "Tirana HQ Equipment Store" });
    console.log("  + Warehouses: Metro Mall Site Store, Tirana HQ");

    const receipt = await createMovement(tenantId, {
      type: "RECEIPT",
      reason: "Initial stock receipt against PO",
      createdById: users.besnik.id,
      lines: [
        { productId: product1.id, qty: 400, unitCost: 3.1, toWarehouseId: siteWarehouse.id },
        { productId: product2.id, qty: 80, unitCost: 4.5, toWarehouseId: hqWarehouse.id },
      ],
    });
    await postMovement(tenantId, { movementId: receipt.id, actorId: users.besnik.id });
    console.log("  + Stock receipt posted (immutable movement + derived StockBalance)");

    const transfer = await createMovement(tenantId, {
      type: "TRANSFER",
      reason: "Reallocate junction boxes to site",
      createdById: users.besnik.id,
      lines: [{ productId: product2.id, qty: 20, fromWarehouseId: hqWarehouse.id, toWarehouseId: siteWarehouse.id }],
    });
    await postMovement(tenantId, { movementId: transfer.id, actorId: users.besnik.id });
    console.log("  + Stock transfer posted");
  }

  // --- CRM (Pipeline/Opportunity, Lead) ----------------------------------------
  if (!(await db.opportunity.findFirst({ where: { tenantId } }))) {
    const client = await db.client.findFirst({ where: { tenantId, name: "Kastrioti Hotels Group" } });
    if (client) {
      await createOpportunity(tenantId, { clientId: client.id, title: "New boutique hotel — 40 rooms", estimatedValue: 3_200_000, ownerId: users.gentian.id });
      console.log("  + Opportunity: Kastrioti Hotels Group — new boutique hotel");
    }
    await createLead(tenantId, { title: "Mixed-use development inquiry", personName: "Vera Metani", personEmail: "vera.metani@example.com", source: "Website", estimatedValue: 1_800_000, ownerId: users.gentian.id });
    await createLead(tenantId, { title: "Warehouse expansion — Elbasan", personName: "Fatmir Osmani", source: "Referral", estimatedValue: 950_000 });
    console.log("  + Leads");
  }
}
