/**
 * Log and audit redaction — PRD §24.2, §24.3, ADR-0017.
 *
 * "Secrets and raw tokens are never logged or stored in audit payloads" is a
 * rule that fails the moment someone logs a whole request body. So redaction is
 * structural and applied by the logger itself, rather than being every
 * developer's responsibility at every call site.
 *
 * Two mechanisms, because two different mistakes happen:
 *   - key matching, for `password`, `token`, `secret` and their neighbours;
 *   - value matching, for a JWT or a bearer token that turns up in a field
 *     nobody thought to name suspiciously.
 */

/**
 * Sensitive key detection, by word rather than by substring.
 *
 * A plain substring match is how `correlationId` gets redacted: it contains
 * "nId", and "nid" was in the list for national identifiers. Losing the
 * correlation id from the logs defeats §25.3 and ACC-23 — the one identifier
 * that traces a flow across the API, a queue and an event consumer — so the key
 * is split on camelCase and separator boundaries and each word is checked.
 */
const SENSITIVE_WORDS = new Set([
  "password", "passwd", "pwd", "secret", "token", "credential", "credentials",
  "authorization", "auth", "cookie", "session", "mfa", "totp", "otp", "seed",
  "recovery", "salary", "wage", "iban", "bic", "swift", "ssn", "nin",
  "nationalid", "passport", "pepper", "kek", "dek", "pin", "signature",
  "privatekey", "apikey", "accesskey", "secretkey",
]);

/** `key` alone is innocuous (idempotencyKey), dangerous in these pairings. */
const KEY_QUALIFIERS = new Set(["api", "secret", "private", "encryption", "access", "signing"]);

/** Likewise `id`: tenantId and userId are the whole point of a log line, while
 *  a national or tax identifier is regulated personal data. */
const ID_QUALIFIERS = new Set(["national", "tax", "social", "personal", "fiscal", "vat", "nuis"]);

function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function isSensitiveKey(key: string): boolean {
  const words = keyWords(key);
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string;
    if (SENSITIVE_WORDS.has(word)) return true;
    if (word === "key" && i > 0 && KEY_QUALIFIERS.has(words[i - 1] as string)) return true;
    if ((word === "id" || word === "number") && i > 0 && ID_QUALIFIERS.has(words[i - 1] as string)) return true;
    if (word === "hash" && i > 0 && SENSITIVE_WORDS.has(words[i - 1] as string)) return true;
  }
  return false;
}

/** A JWT, a bearer token, or a long base64url blob that has no business in a log. */
const SENSITIVE_VALUE = [
  /^ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, // JWT
  /^Bearer\s+\S+/i,
  /^[A-Za-z0-9_-]{40,}$/, // opaque token
];

export const REDACTED = "[redacted]";

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth-limit]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return SENSITIVE_VALUE.some((p) => p.test(value)) ? REDACTED : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

/**
 * The audit change payload: what a field was and what it became, with anything
 * classified CONFIDENTIAL reduced to a marker. The marker still records *that*
 * it changed, which is usually the fact an investigation needs; the value is
 * what it must not carry.
 */
export function redactChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  confidentialFields: ReadonlySet<string> = new Set()
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    if (confidentialFields.has(key) || isSensitiveKey(key)) {
      changes[key] = { from: REDACTED, to: REDACTED };
    } else {
      changes[key] = { from: redact(from), to: redact(to) };
    }
  }
  return changes;
}
