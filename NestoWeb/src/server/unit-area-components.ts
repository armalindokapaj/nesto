import "server-only";
import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";
import { logUnitActivity } from "@/server/unit-activity";
import { validateComponentSet, backCalculateMainPriceFromTotal, type AreaComponentInput } from "@/lib/unit-pricing";

// PRD_Unit_Page §6 — PUT /units/{id}/area-components "replace/reconcile".
// Always replaces the full component set for a unit inside one transaction,
// which is also where the "exactly one isMain" invariant gets enforced —
// Prisma/SQLite can't express that constraint declaratively.
export async function replaceUnitAreaComponents(
  tenantId: string,
  unitId: string,
  actorId: string,
  components: Omit<AreaComponentInput, "id">[]
) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const validationError = validateComponentSet(components);
  if (validationError) throw new Error(validationError);

  await db.$transaction([
    db.unitAreaComponent.deleteMany({ where: { tenantId, unitId } }),
    db.unitAreaComponent.createMany({
      data: components.map((c) => ({
        tenantId,
        unitId,
        componentType: c.componentType,
        label: c.label,
        areaM2: c.areaM2,
        pricePerM2: c.pricePerM2,
        isMain: c.isMain,
        includedInTotal: c.includedInTotal,
        order: c.order,
      })),
    }),
    db.unit.update({ where: { id: unit.id }, data: { version: { increment: 1 } } }),
  ]);

  await logUnitActivity(tenantId, unitId, actorId, "UNIT_UPDATED", "Area components updated.");
}

// PRD §6 — editing the final total back-calculates the main component's
// price/m2 and saves it, leaving every other component's price untouched.
export async function updateUnitFinalPrice(tenantId: string, unitId: string, actorId: string, enteredTotal: number) {
  const unit = assertTenant(
    await db.unit.findUnique({ where: { id: unitId }, include: { areaComponents: { orderBy: { order: "asc" } } } }),
    tenantId,
    "Unit"
  );

  const result = backCalculateMainPriceFromTotal(unit.areaComponents, unit.fixedAdjustment, enteredTotal);
  if ("error" in result) throw new Error(result.error);

  const main = unit.areaComponents.find((c) => c.isMain)!;
  await db.$transaction([
    db.unitAreaComponent.update({ where: { id: main.id }, data: { pricePerM2: result.mainPricePerM2 } }),
    db.unit.update({ where: { id: unit.id }, data: { version: { increment: 1 } } }),
  ]);

  await logUnitActivity(tenantId, unitId, actorId, "UNIT_UPDATED", `Final price set to ${enteredTotal.toLocaleString()}.`);
}
