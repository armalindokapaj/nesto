import { Prisma } from "@/generated/prisma";

// Phase 5 Track A — the codebase has no error monitoring at all: zero
// console.error, zero console.log, no vendor SDK. An unhandled error goes only
// to Vercel's raw function logs, which nobody is alerted on.
//
// This is the seam, not the vendor. Signing up for Sentry, holding its DSN and
// paying for it is an account decision, so it is not made here — but everything
// that has to be right regardless of sink is: one funnel every reporter calls,
// and scrubbing that happens BEFORE anything leaves the process. Wiring Sentry
// then means editing `sink` below and nothing else.
//
// Scrubbing lives here rather than in a vendor `beforeSend` hook on purpose: a
// hook only protects the vendor that installed it, whereas this protects the
// server logs too, which is where the data currently goes.
const SENSITIVE_KEY = /pass(word|Hash)|secret|token|salary|compensation|grossPay|netPay|bankAccount|taxId|iban|ssn|authorization|cookie/i;

export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : scrub(v, depth + 1);
  }
  return out;
}

export type ErrorContext = Record<string, unknown>;

/** The single place an error leaves this application. Attach Sentry here. */
function sink(payload: Record<string, unknown>) {
  // Structured single-line JSON so Vercel's log search can actually filter it,
  // which plain console.error(err) does not allow.
  console.error(JSON.stringify(payload));
}

export function reportError(err: unknown, context: ErrorContext = {}) {
  const base = {
    level: "error",
    at: new Date().toISOString(),
    context: scrub(context),
  };

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    sink({ ...base, kind: "PrismaKnownRequestError", code: err.code, message: err.message, meta: scrub(err.meta) });
    return;
  }
  if (err instanceof Error) {
    sink({ ...base, kind: err.name, message: err.message, stack: err.stack });
    return;
  }
  sink({ ...base, kind: "UnknownThrown", message: String(err) });
}

/** True for errors whose text was never written for a person to read. */
export function isInternalError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    !(err instanceof Error)
  );
}
