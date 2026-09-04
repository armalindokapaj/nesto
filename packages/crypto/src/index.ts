/**
 * Envelope encryption and hashing — ADR-0017, PRD §24.2.
 *
 * What is encrypted and what is hashed is a deliberate distinction, not a
 * preference:
 *   - **Hashed** — passwords, recovery codes, invitation and recovery tokens,
 *     refresh tokens. The system never needs to read these back, so being able
 *     to is pure risk.
 *   - **Encrypted** — MFA seeds, integration credentials, webhook secrets. The
 *     system must present these to a third party, so they have to be reversible.
 *   - **Neither** — ordinary business data. Encrypting it would defeat indexing
 *     and defends against disk theft, which is not the threat model; the threat
 *     model is authorization failure (docs/threat-models/tenant-isolation.md).
 *
 * Envelope, not direct: a per-record data key is wrapped by the KEK, so a KEK
 * rotation re-wraps the small keys and never has to re-encrypt payloads.
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type Ciphertext = {
  /** Which KEK wrapped the data key, so rotation can find what to re-wrap. */
  keyId: string;
  /** base64: wrapped data key ‖ iv ‖ tag ‖ payload iv ‖ payload tag ‖ payload */
  blob: string;
};

function kekFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`CRYPTO_KEK must decode to exactly ${KEY_BYTES} bytes; got ${key.length}.`);
  }
  return key;
}

function gcmSeal(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function gcmOpen(key: Buffer, sealed: Buffer): Buffer {
  const iv = sealed.subarray(0, IV_BYTES);
  const tag = sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = sealed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export class Encryptor {
  private readonly kek: Buffer;

  constructor(
    kekBase64: string,
    readonly keyId: string = "kek-1"
  ) {
    this.kek = kekFrom(kekBase64);
  }

  encrypt(plaintext: string): Ciphertext {
    const dataKey = randomBytes(KEY_BYTES);
    const wrapped = gcmSeal(this.kek, dataKey);
    const payload = gcmSeal(dataKey, Buffer.from(plaintext, "utf8"));
    // Length-prefix the wrapped key so the two sealed blobs can be split again.
    const header = Buffer.alloc(2);
    header.writeUInt16BE(wrapped.length, 0);
    dataKey.fill(0);
    return { keyId: this.keyId, blob: Buffer.concat([header, wrapped, payload]).toString("base64") };
  }

  decrypt(ciphertext: Ciphertext): string {
    const raw = Buffer.from(ciphertext.blob, "base64");
    const wrappedLength = raw.readUInt16BE(0);
    const wrapped = raw.subarray(2, 2 + wrappedLength);
    const payload = raw.subarray(2 + wrappedLength);
    const dataKey = gcmOpen(this.kek, wrapped);
    try {
      return gcmOpen(dataKey, payload).toString("utf8");
    } finally {
      dataKey.fill(0);
    }
  }
}

/** SHA-256 of a token, for storage. Peppered so a database read alone cannot
 *  reconstruct a lookup table of candidate tokens. */
export function hashToken(token: string, pepper: string): string {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

/** Constant-time comparison. Length is compared first because timingSafeEqual
 *  throws on a mismatch, which would itself be a timing signal. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** A URL-safe opaque token: invitations, recovery, refresh, preview tokens. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * The opaque external resource ID of ADR-0018. An internal UUID never leaves
 * the platform to an external audience; an ID obtained under one scope is
 * meaningless under another because the scope is part of the HMAC input.
 */
export function opaqueExternalId(internalId: string, purpose: string, scopeId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${purpose}:${scopeId}:${internalId}`).digest("base64url").slice(0, 32);
}

/** Audit hash chaining, ADR-0008. */
export function chainHash(previousHash: string | null, canonicalEvent: string): string {
  return createHash("sha256").update(`${previousHash ?? ""}|${canonicalEvent}`).digest("hex");
}
