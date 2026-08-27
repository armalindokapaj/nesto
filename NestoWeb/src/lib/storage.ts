import "server-only";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

/**
 * File storage — the one place the platform decides where uploaded bytes live.
 *
 * Uploaded content (drawings, site photos, renders, document revisions) is
 * stored by a driver and referenced from the database by URL. The database
 * holds metadata and relationships only; it never holds file content.
 *
 * Drivers:
 *   local  — writes under `.storage/`. Default for development, tests and CI,
 *            so neither needs a cloud credential to exercise the real paths.
 *   vercel — Vercel Blob. Requires BLOB_READ_WRITE_TOKEN.
 *
 * Visibility is decided per model in STORAGE_VISIBILITY below, never globally.
 */

export type Visibility = "public" | "private";

export type StoredFile = {
  /** Opaque to callers — always round-tripped through readFileFromStorage(). */
  url: string;
  checksum: string;
  size: number;
};

/**
 * Per-model visibility. `private` means the bytes are only ever reachable
 * through a permission-checked route in this app; `public` means the driver
 * may hand out a directly-fetchable URL.
 *
 * Everything is private today. That is a deliberate, narrower choice than
 * "photos and renders can be public": those are currently served through
 * routes that check `can(role, "PROJECTS", "READ")` and the row's tenantId,
 * and a public URL would drop both — any holder of the link, in any tenant,
 * could read another company's site photos and unreleased renders. Flipping a
 * model to "public" is a one-line change here once that trade is wanted.
 */
export const STORAGE_VISIBILITY: Record<StorageModel, Visibility> = {
  documentFile: "private",
  projectPhoto: "private",
  projectRender: "private",
  unitRender: "private",
  drawing: "private",
  drawingRevision: "private",
  submittal: "private",
  specification: "private",
  calculation: "private",
};

export type StorageModel =
  | "documentFile"
  | "projectPhoto"
  | "projectRender"
  | "unitRender"
  | "drawing"
  | "drawingRevision"
  | "submittal"
  | "specification"
  | "calculation";

const LOCAL_PREFIX = "local:";
const LOCAL_ROOT = path.join(process.cwd(), ".storage");

function driver(): "local" | "vercel" {
  return process.env.BLOB_DRIVER === "vercel" ? "vercel" : "local";
}

/** Filesystem-safe, collision-free key. Content lives at <model>/<id>/<name>. */
function buildKey(model: StorageModel, id: string, filename: string) {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "file";
  return `${model}/${id}/${safe}`;
}

function localPathFor(key: string) {
  const full = path.join(LOCAL_ROOT, key);
  // Defence in depth: a crafted key must never escape .storage/.
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key.");
  return full;
}

/**
 * Write bytes and return the URL to persist on the row, plus the SHA-256 the
 * caller should store alongside it. The checksum is computed here so every
 * write path records one, which is what makes the backfill verifiable.
 */
export async function writeFileToStorage(
  model: StorageModel,
  id: string,
  filename: string,
  data: Uint8Array,
  contentType: string
): Promise<StoredFile> {
  const checksum = createHash("sha256").update(data).digest("hex");
  const key = buildKey(model, id, filename);

  if (driver() === "vercel") {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, Buffer.from(data), {
      access: "public", // Vercel Blob URLs are unguessable; privacy is enforced
      contentType, // by this app's routes, per STORAGE_VISIBILITY above.
      addRandomSuffix: true,
    });
    return { url: blob.url, checksum, size: data.byteLength };
  }

  const target = localPathFor(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return { url: `${LOCAL_PREFIX}${key}`, checksum, size: data.byteLength };
}

/** Read bytes back, whichever driver wrote them. */
export async function readFileFromStorage(url: string): Promise<Uint8Array<ArrayBuffer>> {
  if (url.startsWith(LOCAL_PREFIX)) {
    // Uint8Array.from copies into a fresh ArrayBuffer; a Buffer is backed by
    // a shared pool (ArrayBufferLike), which is not a valid Response body.
    return Uint8Array.from(await readFile(localPathFor(url.slice(LOCAL_PREFIX.length))));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Storage read failed (${response.status}) for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function deleteFileFromStorage(url: string): Promise<void> {
  if (url.startsWith(LOCAL_PREFIX)) {
    await unlink(localPathFor(url.slice(LOCAL_PREFIX.length))).catch(() => {});
    return;
  }
  const { del } = await import("@vercel/blob");
  await del(url);
}

/**
 * Whether a stored URL can be handed straight to the browser. False for the
 * local driver and for any model marked private, which is every model today —
 * callers must serve those through their permission-checked route instead.
 */
export function isDirectlyServable(model: StorageModel, url: string | null | undefined): boolean {
  if (!url || url.startsWith(LOCAL_PREFIX)) return false;
  return STORAGE_VISIBILITY[model] === "public";
}
