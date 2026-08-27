import "server-only";
import { db } from "@/lib/db";
import { assertTenant, requireTenantProject } from "@/lib/tenant";
import { requireTenantStructure, requireTenantFloor } from "@/server/project-structures";
import { logUnitActivity } from "@/server/unit-activity";
import { finalPrice, blendedPricePerM2, type AreaComponentInput } from "@/lib/unit-pricing";
import { UNIT_MANUAL_TRANSITIONS } from "@/lib/constants";
import type { UnitLifecycleStatus } from "@/lib/constants";
import { toActionError } from "@/lib/errors";

export type UnitFilters = {
  type?: string[];
  status?: string[];
  structureId?: string;
  floorId?: string;
  q?: string;
};

export type UnitSort = "code_asc" | "code_desc" | "price_asc" | "price_desc" | "createdAt_desc" | "area_desc";

const UNIT_LIST_INCLUDE = {
  structure: { select: { id: true, name: true } },
  floor: { select: { id: true, label: true } },
  areaComponents: true,
  pinnedRender: { select: { id: true } },
  _count: { select: { documentFiles: true } },
} as const;

function buildWhere(tenantId: string, projectId: string, filters: UnitFilters, includeArchived: boolean) {
  return {
    tenantId,
    projectId,
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(filters.type?.length ? { type: { in: filters.type } } : {}),
    ...(filters.status?.length ? { lifecycleStatus: { in: filters.status } } : {}),
    ...(filters.structureId ? { structureId: filters.structureId } : {}),
    ...(filters.floorId ? { floorId: filters.floorId } : {}),
    ...(filters.q
      ? {
          OR: [
            { code: { contains: filters.q, mode: "insensitive" as const } },
            { displayName: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

// PRD_Units §17 UnitReadModel is a denormalized projection for fast sort/
// filter at 50k-unit scale — deliberately not built in Pass 1 (no query
// engine change needed at this app's real scale). Filtering happens in the
// database; sorting/pagination on the *computed* price happens in-process
// after fetch. Fine here; would need a cached price column before this
// approach stopped scaling.
export async function listUnits(
  tenantId: string,
  projectId: string,
  filters: UnitFilters,
  sort: UnitSort = "code_asc",
  page = 1,
  pageSize = 24
) {
  await requireTenantProject(tenantId, projectId);
  const rows = await db.unit.findMany({
    where: buildWhere(tenantId, projectId, filters, false),
    include: UNIT_LIST_INCLUDE,
  });

  const withPricing = rows.map((unit) => ({
    ...unit,
    finalPriceValue: finalPrice(unit.areaComponents as AreaComponentInput[], unit.fixedAdjustment),
    blendedPricePerM2Value: blendedPricePerM2(unit.areaComponents as AreaComponentInput[], unit.fixedAdjustment),
    totalAreaM2: unit.areaComponents.reduce((s, c) => s + c.areaM2, 0),
  }));

  withPricing.sort((a, b) => {
    switch (sort) {
      case "code_desc":
        return b.code.localeCompare(a.code);
      case "price_asc":
        return a.finalPriceValue - b.finalPriceValue;
      case "price_desc":
        return b.finalPriceValue - a.finalPriceValue;
      case "area_desc":
        return b.totalAreaM2 - a.totalAreaM2;
      case "createdAt_desc":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "code_asc":
      default:
        return a.code.localeCompare(b.code);
    }
  });

  const total = withPricing.length;
  const start = (page - 1) * pageSize;
  const items = withPricing.slice(start, start + pageSize);

  return { items, total, page, pageSize };
}

// UNITS-003 — summary counts respect every active filter except the
// unit-type filter the card itself represents, so cards stay meaningful
// while a type filter is active.
export async function getUnitTypeSummary(tenantId: string, projectId: string, filters: Omit<UnitFilters, "type">) {
  await requireTenantProject(tenantId, projectId);
  const rows = await db.unit.findMany({
    where: buildWhere(tenantId, projectId, filters, false),
    select: { type: true, lifecycleStatus: true },
  });

  const byType = new Map<string, { total: number; available: number; reserved: number; soldAssigned: number }>();
  for (const row of rows) {
    const bucket = byType.get(row.type) ?? { total: 0, available: 0, reserved: 0, soldAssigned: 0 };
    bucket.total += 1;
    if (row.lifecycleStatus === "AVAILABLE") bucket.available += 1;
    if (row.lifecycleStatus === "ON_HOLD" || row.lifecycleStatus === "RESERVED") bucket.reserved += 1;
    if (["CONTRACTED", "SOLD", "HANDED_OVER", "COMPANY_OWNED", "RENTED"].includes(row.lifecycleStatus)) bucket.soldAssigned += 1;
    byType.set(row.type, bucket);
  }
  return byType;
}

export async function getUnit(tenantId: string, unitId: string) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { id: true, name: true, code: true } },
      company: { select: { id: true, name: true } },
      structure: { select: { id: true, name: true } },
      floor: { select: { id: true, label: true } },
      areaComponents: { orderBy: { order: "asc" } },
      pinnedRender: { select: { id: true } },
    },
  });
  return assertTenant(unit, tenantId, "Unit");
}

export async function createUnit(
  tenantId: string,
  input: {
    projectId: string;
    companyId: string;
    createdById: string;
    code: string;
    type: string;
    displayName?: string;
    structureId?: string;
    floorId?: string;
    orientation?: string;
    view?: string;
    features?: string;
    notes?: string;
    constructionStatus?: string;
    currency?: string;
    typeFields?: Record<string, unknown>;
  }
) {
  await Promise.all([
    requireTenantProject(tenantId, input.projectId),
    input.structureId ? requireTenantStructure(tenantId, input.structureId) : null,
    input.floorId ? requireTenantFloor(tenantId, input.floorId) : null,
  ]);

  const unit = await db.unit.create({
    data: {
      tenantId,
      projectId: input.projectId,
      companyId: input.companyId,
      code: input.code,
      type: input.type,
      displayName: input.displayName,
      structureId: input.structureId,
      floorId: input.floorId,
      orientation: input.orientation,
      view: input.view,
      features: input.features,
      notes: input.notes,
      constructionStatus: input.constructionStatus,
      currency: input.currency ?? "EUR",
      typeFields: input.typeFields ? JSON.stringify(input.typeFields) : undefined,
    },
  });

  await logUnitActivity(tenantId, unit.id, input.createdById, "UNIT_CREATED", `Unit ${unit.code} created.`);
  return unit;
}

export async function updateUnit(
  tenantId: string,
  unitId: string,
  actorId: string,
  version: number,
  input: {
    code?: string;
    type?: string;
    displayName?: string;
    structureId?: string | null;
    floorId?: string | null;
    orientation?: string;
    view?: string;
    features?: string;
    notes?: string;
    constructionStatus?: string;
    typeFields?: Record<string, unknown>;
  }
) {
  const existing = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  await Promise.all([
    input.structureId ? requireTenantStructure(tenantId, input.structureId) : null,
    input.floorId ? requireTenantFloor(tenantId, input.floorId) : null,
  ]);

  const result = await db.unit.updateMany({
    where: { id: unitId, version },
    data: {
      ...input,
      typeFields: input.typeFields !== undefined ? JSON.stringify(input.typeFields) : undefined,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    throw new Error(`This unit was changed by someone else (currently at version ${existing.version}). Reload and try again.`);
  }
  await logUnitActivity(tenantId, unitId, actorId, "UNIT_UPDATED", "Unit details updated.");
  return db.unit.findUnique({ where: { id: unitId } });
}

export async function transitionUnitStatus(tenantId: string, unitId: string, actorId: string, nextStatus: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const allowed = UNIT_MANUAL_TRANSITIONS[unit.lifecycleStatus as UnitLifecycleStatus] ?? [];
  if (!allowed.includes(nextStatus as UnitLifecycleStatus)) {
    throw new Error(`Cannot move a unit from ${unit.lifecycleStatus} to ${nextStatus} without the sales workflow (holds/reservations/contracts).`);
  }
  // Compare-and-swap on the status we validated against, not a bare update.
  // Read-then-write let two callers both read AVAILABLE, both find their own
  // target in the allowed list, and both write — last one wins silently.
  // updateUnit() above already guards this way on `version`.
  const result = await db.unit.updateMany({
    where: { id: unitId, version: unit.version, lifecycleStatus: unit.lifecycleStatus },
    data: { lifecycleStatus: nextStatus, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new Error("This unit was changed by someone else. Reload and try again.");
  }
  await logUnitActivity(tenantId, unitId, actorId, "STATUS_CHANGED", `Status changed from ${unit.lifecycleStatus} to ${nextStatus}.`);
}

export async function duplicateUnit(tenantId: string, unitId: string, actorId: string, input: { code: string }) {
  const source = assertTenant(
    await db.unit.findUnique({ where: { id: unitId }, include: { areaComponents: true } }),
    tenantId,
    "Unit"
  );

  const duplicate = await db.unit.create({
    data: {
      tenantId,
      projectId: source.projectId,
      companyId: source.companyId,
      structureId: source.structureId,
      floorId: source.floorId,
      code: input.code,
      type: source.type,
      displayName: source.displayName,
      orientation: source.orientation,
      view: source.view,
      features: source.features,
      notes: source.notes,
      constructionStatus: source.constructionStatus,
      currency: source.currency,
      fixedAdjustment: source.fixedAdjustment,
      typeFields: source.typeFields,
      // Never copy buyer/reservation/payment/contract/handover state — none
      // of that exists on Unit itself in Pass 1, so there's nothing to strip.
      areaComponents: {
        create: source.areaComponents.map((c) => ({
          tenantId,
          componentType: c.componentType,
          label: c.label,
          areaM2: c.areaM2,
          pricePerM2: c.pricePerM2,
          isMain: c.isMain,
          includedInTotal: c.includedInTotal,
          order: c.order,
        })),
      },
    },
  });

  await logUnitActivity(tenantId, duplicate.id, actorId, "UNIT_CREATED", `Duplicated from ${source.code}.`);
  return duplicate;
}

// Archiving is a lifecycle transition like any other, so it goes through the
// table rather than around it. It used to set lifecycleStatus: "ARCHIVED"
// directly after checking only that the unit existed — which meant a SOLD unit,
// with a real client and a real PURCHASED relationship behind it, could be
// archived out of the live unit list even though UNIT_MANUAL_TRANSITIONS lists
// SOLD -> ARCHIVED as forbidden three lines away in constants.ts.
//
// Delegating (rather than re-checking the table here) keeps one copy of the
// rule: if the table changes, this follows automatically, and the caller gets
// the same error message every other forbidden transition produces.
export async function archiveUnit(tenantId: string, unitId: string, actorId: string) {
  await transitionUnitStatus(tenantId, unitId, actorId, "ARCHIVED");
  await db.unit.update({ where: { id: unitId }, data: { archivedAt: new Date() } });
  await logUnitActivity(tenantId, unitId, actorId, "ARCHIVED", "Unit archived.");
}

export async function restoreUnit(tenantId: string, unitId: string, actorId: string) {
  const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
  const conflict = await db.unit.findFirst({ where: { tenantId, projectId: unit.projectId, code: unit.code, archivedAt: null, id: { not: unitId } } });
  if (conflict) throw new Error(`Unit code ${unit.code} is already in use — rename before restoring.`);
  // The archivedAt guard is the point: restore resets lifecycleStatus to DRAFT,
  // so running it against a *live* unit silently discarded whatever state it
  // was in — a SOLD unit would come back as an unsold draft. Nothing checked
  // that the unit was archived at all before.
  const restored = await db.unit.updateMany({
    where: { id: unitId, version: unit.version, archivedAt: { not: null } },
    data: { archivedAt: null, lifecycleStatus: "DRAFT", version: { increment: 1 } },
  });
  if (restored.count === 0) {
    throw new Error("This unit is not archived, or was changed by someone else. Reload and try again.");
  }
  await logUnitActivity(tenantId, unitId, actorId, "RESTORED", "Unit restored from archive.");
}

export async function bulkUpdateUnits(
  tenantId: string,
  unitIds: string[],
  actorId: string,
  input: { structureId?: string | null; floorId?: string | null; constructionStatus?: string; status?: string }
) {
  const results: { unitId: string; ok: boolean; error?: string }[] = [];
  for (const unitId of unitIds) {
    try {
      if (input.status) {
        await transitionUnitStatus(tenantId, unitId, actorId, input.status);
      }
      if (input.structureId !== undefined || input.floorId !== undefined || input.constructionStatus !== undefined) {
        const unit = assertTenant(await db.unit.findUnique({ where: { id: unitId } }), tenantId, "Unit");
        await db.unit.update({
          where: { id: unitId },
          data: {
            structureId: input.structureId === undefined ? undefined : input.structureId,
            floorId: input.floorId === undefined ? undefined : input.floorId,
            constructionStatus: input.constructionStatus ?? undefined,
            version: { increment: 1 },
          },
        });
        await logUnitActivity(tenantId, unit.id, actorId, "UNIT_UPDATED", "Bulk update applied.");
      }
      results.push({ unitId, ok: true });
    } catch (err) {
      results.push({ unitId, ok: false, error: toActionError(err, "Unknown error") });
    }
  }
  return results;
}
