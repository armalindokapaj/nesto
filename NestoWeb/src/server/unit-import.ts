import "server-only";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { requireTenantProject } from "@/lib/tenant";
import { createUnit } from "@/server/units";
import { UNIT_TYPES } from "@/lib/constants";
import { toActionError } from "@/lib/errors";

// PRD_Units §10 — simplified synchronous dry-run/commit (CSV only, no
// async job/template generator — this app has no job queue, and the PRD's
// own downloadable-template step is skipped in favor of just documenting
// the expected header row via UNIT_IMPORT_COLUMNS in lib/constants.ts,
// shown inline in the import dialog).

export type ImportRowError = { row: number; message: string };
export type ParsedImportRow = {
  row: number;
  code: string;
  type: string;
  displayName?: string;
  structureId?: string;
  floorId?: string;
  internalAreaM2: number;
  internalPricePerM2: number;
  balconyAreaM2?: number;
  balconyPricePerM2?: number;
  orientation?: string;
  view?: string;
  notes?: string;
};

export async function dryRunUnitsImport(tenantId: string, projectId: string, csvText: string) {
  await requireTenantProject(tenantId, projectId);

  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return { validRows: [] as ParsedImportRow[], errors: [{ row: 0, message: `Could not parse CSV: ${toActionError(err, "invalid file")}` }] };
  }

  const [existingUnits, structures] = await Promise.all([
    db.unit.findMany({ where: { tenantId, projectId }, select: { code: true } }),
    db.projectStructure.findMany({ where: { tenantId, projectId }, include: { floors: true } }),
  ]);
  const existingCodes = new Set(existingUnits.map((u) => u.code));
  const structureByName = new Map(structures.map((s) => [s.name.toLowerCase(), s]));
  const seenCodesInFile = new Set<string>();

  const errors: ImportRowError[] = [];
  const validRows: ParsedImportRow[] = [];

  records.forEach((record, index) => {
    const row = index + 2; // header is row 1
    const code = record.code?.trim();
    const type = record.type?.trim().toUpperCase();

    if (!code) return errors.push({ row, message: "Missing unit code." });
    if (existingCodes.has(code) || seenCodesInFile.has(code)) return errors.push({ row, message: `Duplicate unit code "${code}".` });
    if (!type || !(UNIT_TYPES as readonly string[]).includes(type)) {
      return errors.push({ row, message: `Unknown unit type "${record.type}". Must be one of: ${UNIT_TYPES.join(", ")}.` });
    }

    let structureId: string | undefined;
    let floorId: string | undefined;
    if (record.structureName?.trim()) {
      const structure = structureByName.get(record.structureName.trim().toLowerCase());
      if (!structure) return errors.push({ row, message: `Unknown structure "${record.structureName}" — create it on the Units page first.` });
      structureId = structure.id;
      if (record.floorLabel?.trim()) {
        const floor = structure.floors.find((f) => f.label.toLowerCase() === record.floorLabel.trim().toLowerCase());
        if (!floor) return errors.push({ row, message: `Unknown floor "${record.floorLabel}" in structure "${record.structureName}".` });
        floorId = floor.id;
      }
    }

    const internalAreaM2 = Number(record.internalAreaM2 ?? 0);
    const internalPricePerM2 = Number(record.internalPricePerM2 ?? 0);
    if (Number.isNaN(internalAreaM2) || internalAreaM2 < 0) return errors.push({ row, message: "Internal area must be a non-negative number." });
    if (Number.isNaN(internalPricePerM2) || internalPricePerM2 < 0) return errors.push({ row, message: "Internal price/m² must be a non-negative number." });

    const balconyAreaM2 = record.balconyAreaM2 ? Number(record.balconyAreaM2) : undefined;
    const balconyPricePerM2 = record.balconyPricePerM2 ? Number(record.balconyPricePerM2) : undefined;
    if (balconyAreaM2 !== undefined && (Number.isNaN(balconyAreaM2) || balconyAreaM2 < 0)) {
      return errors.push({ row, message: "Balcony area must be a non-negative number." });
    }

    seenCodesInFile.add(code);
    validRows.push({
      row,
      code,
      type,
      displayName: record.displayName?.trim() || undefined,
      structureId,
      floorId,
      internalAreaM2,
      internalPricePerM2,
      balconyAreaM2,
      balconyPricePerM2,
      orientation: record.orientation?.trim() || undefined,
      view: record.view?.trim() || undefined,
      notes: record.notes?.trim() || undefined,
    });
  });

  return { validRows, errors };
}

export async function commitUnitsImport(
  tenantId: string,
  projectId: string,
  companyId: string,
  actorId: string,
  rows: ParsedImportRow[]
) {
  let created = 0;
  const failed: ImportRowError[] = [];

  for (const row of rows) {
    try {
      const unit = await createUnit(tenantId, {
        projectId,
        companyId,
        createdById: actorId,
        code: row.code,
        type: row.type,
        displayName: row.displayName,
        structureId: row.structureId,
        floorId: row.floorId,
        orientation: row.orientation,
        view: row.view,
        notes: row.notes,
      });

      const components = [{ tenantId, unitId: unit.id, componentType: "INTERNAL", label: "Internal", areaM2: row.internalAreaM2, pricePerM2: row.internalPricePerM2, isMain: true, includedInTotal: true, order: 0 }];
      if (row.balconyAreaM2 !== undefined) {
        components.push({ tenantId, unitId: unit.id, componentType: "BALCONY", label: "Balcony", areaM2: row.balconyAreaM2, pricePerM2: row.balconyPricePerM2 ?? 0, isMain: false, includedInTotal: true, order: 1 });
      }
      await db.unitAreaComponent.createMany({ data: components });
      created += 1;
    } catch (err) {
      failed.push({ row: row.row, message: toActionError(err, "Could not create unit.") });
    }
  }

  return { created, failed };
}
