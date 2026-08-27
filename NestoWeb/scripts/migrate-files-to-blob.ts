/**
 * Phase 0 Track B — move file content out of the database.
 *
 * ONE-TIME SCRIPT, ALREADY RUN. It requires the pre-migration schema, i.e.
 * before 20260827210824_drop_file_content_columns removed `fileData` and
 * `fileDataUrl`. It is kept because it documents exactly how the migration
 * was performed and is what you would reach for to migrate any other database
 * still carrying those columns; against the current schema it will error out
 * on the first query. Running order was: add the fileUrl columns, `migrate`,
 * `verify`, and only then drop.
 *
 * On this database it found 0 rows — the seeds never wrote file content — and
 * `verify` reported 0 mismatches and 0 unmigrated. Its correctness is covered
 * by tests/unit/file-storage-migration.test.ts, which exercised it against a
 * real row holding real bytes while the legacy columns still existed.
 *
 * Two commands, deliberately separate so nothing is destroyed on the strength
 * of "the upload didn't throw":
 *
 *   tsx scripts/migrate-files-to-blob.ts migrate
 *     For every row still holding content in the database, write the bytes to
 *     storage and record the resulting URL (and its SHA-256) on the row. The
 *     old column is left exactly as it was. Re-runnable: rows that already
 *     have a fileUrl are skipped.
 *
 *   tsx scripts/migrate-files-to-blob.ts verify
 *     For every migrated row, read the bytes BACK from storage and compare
 *     their SHA-256 against a hash recomputed from the original database
 *     content. This compares content to content — it does not trust the
 *     checksum column, which is itself part of what is being migrated.
 *
 * Only once `verify` reports zero mismatches and zero unmigrated rows should
 * the migration that drops the old columns be applied.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { writeFileToStorage, readFileFromStorage, type StorageModel } from "@/lib/storage";

type Row = Record<string, unknown>;

/**
 * Models whose content lives in a `Bytes` column. `optional` records whether
 * that column is nullable: on the three gallery models it is required, and
 * Prisma rejects `{ not: null }` against a required field, so the presence
 * filter has to differ per model.
 */
const BYTES_MODELS: { model: StorageModel; optional: boolean; nameFrom: (r: Row) => string; mimeFrom: (r: Row) => string }[] = [
  { model: "projectRender", optional: false, nameFrom: (r) => `render-${r.id}`, mimeFrom: (r) => String(r.fileMimeType ?? "application/octet-stream") },
  { model: "projectPhoto", optional: false, nameFrom: (r) => `photo-${r.id}`, mimeFrom: (r) => String(r.fileMimeType ?? "application/octet-stream") },
  { model: "unitRender", optional: false, nameFrom: (r) => `render-${r.id}`, mimeFrom: (r) => String(r.fileMimeType ?? "application/octet-stream") },
  { model: "documentFile", optional: true, nameFrom: (r) => String(r.name ?? `document-${r.id}`), mimeFrom: (r) => String(r.fileMimeType ?? "application/octet-stream") },
];

/** Presence filter for a Bytes column, respecting whether it is nullable. */
const hasBytes = (optional: boolean) => (optional ? { fileData: { not: null } } : {});

/** Models whose content lives as a base64 (data:) string in a text column. */
const BASE64_MODELS: { model: StorageModel; nameFrom: (r: Row) => string }[] = [
  { model: "drawing", nameFrom: (r) => String(r.revisionCode ?? r.id) },
  { model: "drawingRevision", nameFrom: (r) => String(r.code ?? r.id) },
  { model: "submittal", nameFrom: (r) => String(r.number ?? r.id) },
  { model: "specification", nameFrom: (r) => String(r.code ?? r.id) },
  { model: "calculation", nameFrom: (r) => String(r.code ?? r.id) },
];

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (model: StorageModel) => (db as any)[model];

/** Accepts "data:<mime>;base64,<payload>" as well as a bare base64 payload. */
function decodeDataUrl(value: string): { data: Uint8Array; mimeType: string } {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value);
  if (!match) return { data: new Uint8Array(Buffer.from(value, "base64")), mimeType: "application/octet-stream" };
  const [, mimeType, isBase64, payload] = match;
  const data = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  return { data: new Uint8Array(data), mimeType: mimeType || "application/octet-stream" };
}

export async function migrateFilesToStorage() {
  let migrated = 0;

  for (const { model, optional, nameFrom, mimeFrom } of BYTES_MODELS) {
    const rows: Row[] = await table(model).findMany({ where: { ...hasBytes(optional), fileUrl: null } });
    for (const row of rows) {
      const data = new Uint8Array(row.fileData as Uint8Array);
      const stored = await writeFileToStorage(model, String(row.id), nameFrom(row), data, mimeFrom(row));
      await table(model).update({
        where: { id: row.id },
        data: { fileUrl: stored.url, checksum: stored.checksum, fileSize: stored.size },
      });
      migrated++;
    }
    console.log(`  ${model.padEnd(16)} ${rows.length} row(s) migrated`);
  }

  for (const { model, nameFrom } of BASE64_MODELS) {
    const rows: Row[] = await table(model).findMany({ where: { fileDataUrl: { not: null }, fileUrl: null } });
    for (const row of rows) {
      const { data, mimeType } = decodeDataUrl(String(row.fileDataUrl));
      const stored = await writeFileToStorage(model, String(row.id), nameFrom(row), data, mimeType);
      await table(model).update({ where: { id: row.id }, data: { fileUrl: stored.url } });
      migrated++;
    }
    console.log(`  ${model.padEnd(16)} ${rows.length} row(s) migrated`);
  }

  console.log(`\nmigrate: ${migrated} file(s) written to storage.`);
}

export async function verifyMigratedFiles() {
  let checked = 0;
  const mismatches: string[] = [];
  const unmigrated: string[] = [];

  for (const { model, optional } of BYTES_MODELS) {
    const rows: Row[] = await table(model).findMany({ where: hasBytes(optional) });
    for (const row of rows) {
      if (!row.fileUrl) {
        unmigrated.push(`${model}:${row.id}`);
        continue;
      }
      const original = sha256(new Uint8Array(row.fileData as Uint8Array));
      const roundTripped = sha256(await readFileFromStorage(String(row.fileUrl)));
      if (original !== roundTripped) mismatches.push(`${model}:${row.id} (db ${original.slice(0, 12)} vs storage ${roundTripped.slice(0, 12)})`);
      // The checksum column must also agree, since that is what production
      // integrity checks will read once fileData is gone.
      else if (row.checksum && row.checksum !== original) mismatches.push(`${model}:${row.id} (checksum column stale)`);
      checked++;
    }
  }

  for (const { model } of BASE64_MODELS) {
    const rows: Row[] = await table(model).findMany({ where: { fileDataUrl: { not: null } } });
    for (const row of rows) {
      if (!row.fileUrl) {
        unmigrated.push(`${model}:${row.id}`);
        continue;
      }
      const original = sha256(decodeDataUrl(String(row.fileDataUrl)).data);
      const roundTripped = sha256(await readFileFromStorage(String(row.fileUrl)));
      if (original !== roundTripped) mismatches.push(`${model}:${row.id}`);
      checked++;
    }
  }

  console.log(`\nverify: ${checked} file(s) checked, ${mismatches.length} mismatch(es), ${unmigrated.length} unmigrated.`);
  for (const m of mismatches) console.error(`  MISMATCH  ${m}`);
  for (const u of unmigrated) console.error(`  UNMIGRATED ${u}`);
  if (mismatches.length || unmigrated.length) console.error("\nDo NOT drop the old columns.");
  else console.log("All migrated content round-trips byte-identically. Safe to drop the old columns.");
  return { checked, mismatches, unmigrated };
}

// CLI entry point. Guarded so the two functions above can be imported by
// tests without running anything. Wrapped in main() rather than using
// top-level await, which this project's tsx/CJS transform rejects.
async function main() {
  const command = process.argv[2];
  if (command !== "migrate" && command !== "verify") {
    console.error("usage: tsx scripts/migrate-files-to-blob.ts <migrate|verify>");
    process.exit(2);
  }
  if (command === "migrate") {
    await migrateFilesToStorage();
  } else {
    const { mismatches, unmigrated } = await verifyMigratedFiles();
    if (mismatches.length || unmigrated.length) process.exitCode = 1;
  }
  await db.$disconnect();
}

if (process.argv[1]?.includes("migrate-files-to-blob")) void main();
