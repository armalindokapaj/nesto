/**
 * TOTP — RFC 6238, ADR-0003, PRD §7.2.
 *
 * Implemented directly rather than pulled in, because it is thirty lines of
 * HMAC and the alternative is trusting an unaudited dependency with the second
 * factor for Platform Admin and every company Owner.
 *
 * The ±1 step window is deliberate and bounded: it tolerates a phone whose
 * clock is up to 30 seconds out, and no more. A wider window multiplies the
 * space an attacker can brute-force within a code's lifetime.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeForCounter(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function currentTotp(secret: string, at: Date = new Date()): string {
  return codeForCounter(secret, Math.floor(at.getTime() / 1000 / STEP_SECONDS));
}

/**
 * Verify a submitted code. Returns the matched counter so the caller can store
 * it and refuse a replay — a code stays valid for its whole 30-second step, and
 * without this a captured code is reusable inside that window.
 */
export function verifyTotp(
  secret: string,
  submitted: string,
  options: { at?: Date; lastUsedCounter?: number } = {}
): { valid: boolean; counter?: number } {
  const code = submitted.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { valid: false };

  const now = Math.floor((options.at ?? new Date()).getTime() / 1000 / STEP_SECONDS);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const counter = now + drift;
    if (options.lastUsedCounter !== undefined && counter <= options.lastUsedCounter) continue;
    const expected = Buffer.from(codeForCounter(secret, counter));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      return { valid: true, counter };
    }
  }
  return { valid: false };
}

/** The otpauth:// URI an authenticator app scans. */
export function totpUri(secret: string, account: string, issuer = "Nesto"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten single-use recovery codes. Formatted in groups because people read
 *  these off a screen and type them under stress. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}
