/**
 * Content inspection — PRD §21.2.
 *
 * "MIME based on inspected content, not client claim alone." A browser sends
 * whatever it likes in `Content-Type`, and an attacker sends whatever gets past
 * the filter, so the declared type is a hint and the magic bytes are the fact.
 *
 * A mismatch is not silently corrected. A file claiming to be a PDF whose bytes
 * say otherwise is rejected, because the interesting case is not a confused
 * browser — it is a deliberate one.
 */

type Signature = { mime: string; offset: number; bytes: number[]; extensions: string[] };

const SIGNATURES: Signature[] = [
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], extensions: ["pdf"] },
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], extensions: ["png"] },
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff], extensions: ["jpg", "jpeg"] },
  { mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], extensions: ["gif"] },
  { mime: "image/webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50], extensions: ["webp"] },
  { mime: "image/tiff", offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00], extensions: ["tif", "tiff"] },
  // Office documents and anything else zip-based share this signature; the
  // container is confirmed here and the specific type comes from the extension.
  { mime: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], extensions: ["zip", "docx", "xlsx", "pptx", "ifc" ] },
  { mime: "application/vnd.ms-office", offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0], extensions: ["doc", "xls", "ppt"] },
  { mime: "model/gltf-binary", offset: 0, bytes: [0x67, 0x6c, 0x54, 0x46], extensions: ["glb"] },
];

/** Types a construction platform legitimately receives. Anything else is
 *  refused at the intent step, before a byte is uploaded (§21.1 step 2). */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/tiff",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-office", "application/msword", "application/vnd.ms-excel",
  "text/plain", "text/csv",
  "model/gltf-binary", "model/gltf+json",
  "application/dxf", "image/vnd.dwg",
]);

export function sniffMime(head: Buffer): string | null {
  for (const sig of SIGNATURES) {
    if (head.length < sig.offset + sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => head[sig.offset + i] === b)) return sig.mime;
  }
  // Plain text has no signature. Treat a head that is entirely printable plus
  // ordinary whitespace as text; anything with control bytes is not.
  if (head.length > 0 && head.every((b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f) || b >= 0x80)) {
    return "text/plain";
  }
  return null;
}

export type InspectionResult =
  | { ok: true; mime: string }
  | { ok: false; reason: "TYPE_NOT_ALLOWED" | "CONTENT_MISMATCH" | "UNRECOGNISED" };

export function inspect(head: Buffer, declaredMime: string, fileName: string): InspectionResult {
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) return { ok: false, reason: "TYPE_NOT_ALLOWED" };

  const detected = sniffMime(head);
  if (!detected) return { ok: false, reason: "UNRECOGNISED" };

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const signature = SIGNATURES.find((s) => s.mime === detected);

  // Office formats are zip containers, so the container plus a matching
  // extension is as specific as the bytes can be.
  if (detected === "application/zip" || detected === "application/vnd.ms-office") {
    return signature?.extensions.includes(extension)
      ? { ok: true, mime: declaredMime }
      : { ok: false, reason: "CONTENT_MISMATCH" };
  }

  if (detected !== declaredMime && !(detected === "text/plain" && (declaredMime === "text/csv" || declaredMime === "model/gltf+json"))) {
    return { ok: false, reason: "CONTENT_MISMATCH" };
  }
  return { ok: true, mime: detected };
}

/**
 * CSV formula-injection protection — PRD §10.1, §24.1.
 *
 * A cell beginning `=`, `+`, `-` or `@` is executed as a formula by Excel and
 * Sheets when the export is opened. `=HYPERLINK(...)` exfiltrating the row to a
 * remote host is a real, widely-exploited pattern, and it is *our* export that
 * carries it. Prefixing with a tab neutralises the formula while leaving the
 * value readable.
 */
export function escapeCsvCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
}
