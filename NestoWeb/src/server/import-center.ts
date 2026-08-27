import "server-only";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { toActionError } from "@/lib/errors";

// PRD_Platform_UI_UX_Architecture §22 Import Center — the generic
// upload -> map -> validate -> detect duplicates -> preview -> commit ->
// reconcile flow, generalized from the one entity-specific case that
// already existed (src/server/unit-import.ts, kept as-is and still linked
// from its own project page — not migrated here, to avoid touching a
// working, already-tested flow). Same simplified synchronous dry-run/commit
// shape as that one: CSV only, no async job queue (none exists in this
// app), no XLSX/downloadable-template generator (the expected header row
// is documented inline instead).

export type ImportRowError = { row: number; message: string };
export type ImportDryRunResult<T> = { validRows: T[]; errors: ImportRowError[] };
export type ImportCommitResult = { created: number; failed: ImportRowError[] };

export const IMPORTABLE_ENTITIES = [
  { key: "EMPLOYEES", label: "Employees", columns: ["fullName", "position", "department", "hireDate", "phone"] },
  { key: "CLIENTS", label: "Clients", columns: ["name", "contactName", "email", "phone"] },
] as const;
export type ImportableEntity = (typeof IMPORTABLE_ENTITIES)[number]["key"];

export function importColumnsFor(entity: ImportableEntity): readonly string[] {
  return IMPORTABLE_ENTITIES.find((e) => e.key === entity)!.columns;
}

function parseCsv(csvText: string): { records: Record<string, string>[]; parseError?: ImportRowError } {
  try {
    return { records: parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) };
  } catch (err) {
    return { records: [], parseError: { row: 0, message: `Could not parse CSV: ${toActionError(err, "invalid file")}` } };
  }
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

type EmployeeRow = { row: number; fullName: string; position: string; department: string; hireDate: Date; phone?: string };

async function dryRunEmployees(tenantId: string, csvText: string): Promise<ImportDryRunResult<EmployeeRow>> {
  const { records, parseError } = parseCsv(csvText);
  if (parseError) return { validRows: [], errors: [parseError] };

  const existing = await db.employee.findMany({ where: { tenantId }, select: { fullName: true } });
  const existingNames = new Set(existing.map((e) => e.fullName.toLowerCase()));
  const seenInFile = new Set<string>();
  const errors: ImportRowError[] = [];
  const validRows: EmployeeRow[] = [];

  records.forEach((record, index) => {
    const row = index + 2;
    const fullName = record.fullName?.trim();
    if (!fullName) return errors.push({ row, message: "Missing full name." });
    const key = fullName.toLowerCase();
    if (existingNames.has(key) || seenInFile.has(key)) return errors.push({ row, message: `Duplicate candidate — "${fullName}" already exists.` });
    if (!record.position?.trim()) return errors.push({ row, message: "Missing position." });
    if (!record.department?.trim()) return errors.push({ row, message: "Missing department." });
    const hireDate = record.hireDate ? new Date(record.hireDate) : new Date();
    if (Number.isNaN(hireDate.getTime())) return errors.push({ row, message: `Invalid hire date "${record.hireDate}" — use YYYY-MM-DD.` });

    seenInFile.add(key);
    validRows.push({ row, fullName, position: record.position.trim(), department: record.department.trim(), hireDate, phone: record.phone?.trim() || undefined });
  });

  return { validRows, errors };
}

async function commitEmployees(tenantId: string, rows: EmployeeRow[]): Promise<ImportCommitResult> {
  let created = 0;
  const failed: ImportRowError[] = [];
  for (const row of rows) {
    try {
      await db.employee.create({ data: { tenantId, fullName: row.fullName, position: row.position, department: row.department, hireDate: row.hireDate, phone: row.phone } });
      created++;
    } catch (err) {
      failed.push({ row: row.row, message: toActionError(err, "Could not create employee.") });
    }
  }
  return { created, failed };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

type ClientRow = { row: number; name: string; contactName?: string; email?: string; phone?: string };

async function dryRunClients(tenantId: string, csvText: string): Promise<ImportDryRunResult<ClientRow>> {
  const { records, parseError } = parseCsv(csvText);
  if (parseError) return { validRows: [], errors: [parseError] };

  const existing = await db.client.findMany({ where: { tenantId }, select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  const seenInFile = new Set<string>();
  const errors: ImportRowError[] = [];
  const validRows: ClientRow[] = [];

  records.forEach((record, index) => {
    const row = index + 2;
    const name = record.name?.trim();
    if (!name) return errors.push({ row, message: "Missing client name." });
    const key = name.toLowerCase();
    if (existingNames.has(key) || seenInFile.has(key)) return errors.push({ row, message: `Duplicate candidate — "${name}" already exists.` });

    seenInFile.add(key);
    validRows.push({ row, name, contactName: record.contactName?.trim() || undefined, email: record.email?.trim() || undefined, phone: record.phone?.trim() || undefined });
  });

  return { validRows, errors };
}

async function commitClients(tenantId: string, actorId: string, rows: ClientRow[]): Promise<ImportCommitResult> {
  let created = 0;
  const failed: ImportRowError[] = [];
  for (const row of rows) {
    try {
      await db.client.create({ data: { tenantId, createdById: actorId, name: row.name, contactName: row.contactName, email: row.email, phone: row.phone } });
      created++;
    } catch (err) {
      failed.push({ row: row.row, message: toActionError(err, "Could not create client.") });
    }
  }
  return { created, failed };
}

// ---------------------------------------------------------------------------
// Dispatcher — the one seam a new importable entity would extend.
// ---------------------------------------------------------------------------

export async function dryRunImport(tenantId: string, entity: ImportableEntity, csvText: string): Promise<ImportDryRunResult<EmployeeRow | ClientRow>> {
  if (entity === "EMPLOYEES") return dryRunEmployees(tenantId, csvText);
  return dryRunClients(tenantId, csvText);
}

export async function commitImport(tenantId: string, actorId: string, entity: ImportableEntity, rows: (EmployeeRow | ClientRow)[]): Promise<ImportCommitResult> {
  if (entity === "EMPLOYEES") return commitEmployees(tenantId, rows as EmployeeRow[]);
  return commitClients(tenantId, actorId, rows as ClientRow[]);
}
