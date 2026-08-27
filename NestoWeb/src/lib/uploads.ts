import "server-only";

// Phase 3 Track C — the upload helpers capped size and rejected empty files but
// took `file.type` straight from the browser with no check at all, so a file
// claiming to be image/jpeg was never verified to be one.
//
// An allowlist of declared types alone would not close that: the declared type
// is attacker-controlled, so allowlisting it only stops honest mistakes. The
// magic-byte check below is what actually verifies the claim. Both run — the
// allowlist gives a clear message for an ordinary wrong-file mistake, the
// sniff catches a lie.
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export const DOCUMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "model/gltf-binary",
  "model/gltf+json",
] as const;

type Signature = { mime: string; bytes: number[]; offset?: number };

// Only formats with a stable, unambiguous leading signature are listed. A type
// that is not here (plain text, CSV, the OOXML/zip family) simply is not
// sniffable this way, so it passes on the allowlist alone rather than being
// rejected by a check that cannot see it.
const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: "image/avif", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "model/gltf-binary", bytes: [0x67, 0x6c, 0x54, 0x46] },
];

function matches(data: Uint8Array, sig: Signature) {
  const at = sig.offset ?? 0;
  if (data.length < at + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => data[at + i] === b);
}

/** True when the declared type has a known signature and the bytes disagree with it. */
export function contentDisagreesWithType(data: Uint8Array, mimeType: string): boolean {
  const expected = SIGNATURES.filter((s) => s.mime === mimeType);
  if (expected.length === 0) return false;
  return !expected.some((sig) => matches(data, sig));
}

export function assertAllowedUpload(
  data: Uint8Array,
  mimeType: string,
  allowed: readonly string[],
  label = "file"
) {
  if (!allowed.includes(mimeType)) {
    throw new Error(`That ${label} type is not accepted (${mimeType || "unknown"}).`);
  }
  if (contentDisagreesWithType(data, mimeType)) {
    throw new Error(`This ${label} does not match its declared type (${mimeType}).`);
  }
}
