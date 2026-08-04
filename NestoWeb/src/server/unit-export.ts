import "server-only";
import { db } from "@/lib/db";
import { requireTenantProject } from "@/lib/tenant";
import { finalPrice, type AreaComponentInput } from "@/lib/unit-pricing";

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// PRD_Units §11 — CSV only (no XLSX), synchronous, browser download. Uses
// the same backend query/pricing logic the page itself uses (UNITS-014),
// just without pagination.
export async function buildUnitsCsv(tenantId: string, projectId: string): Promise<string> {
  await requireTenantProject(tenantId, projectId);
  const units = await db.unit.findMany({
    where: { tenantId, projectId, archivedAt: null },
    include: { structure: true, floor: true, areaComponents: true },
    orderBy: { code: "asc" },
  });

  const header = [
    "code",
    "type",
    "displayName",
    "structureName",
    "floorLabel",
    "lifecycleStatus",
    "totalAreaM2",
    "finalPrice",
    "currency",
  ];

  const rows = units.map((u) => {
    const totalArea = u.areaComponents.reduce((s, c) => s + c.areaM2, 0);
    const price = finalPrice(u.areaComponents as AreaComponentInput[], u.fixedAdjustment);
    return [u.code, u.type, u.displayName ?? "", u.structure?.name ?? "", u.floor?.label ?? "", u.lifecycleStatus, totalArea, price, u.currency]
      .map(csvEscape)
      .join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
