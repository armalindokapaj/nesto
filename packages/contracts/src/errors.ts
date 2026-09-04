/**
 * The baseline error codes of PRD §19.8, and the one class the API translates
 * into the §19.3 envelope.
 *
 * The rule that shapes this file: a response must not reveal whether an
 * unauthorized record exists (§19.3). So `NOT_FOUND` is what the caller sees
 * both when a row is absent and when it is outside their scope, and the
 * distinction is recorded in the audit trail instead of the response.
 */

export const ERROR_CODES = {
  AUTH_INVALID: { status: 401, retryable: false },
  MFA_REQUIRED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  NOT_FOUND: { status: 404, retryable: false },
  CONFLICT: { status: 409, retryable: false },
  SEAT_LIMIT_REACHED: { status: 409, retryable: false },
  INVITE_EXPIRED: { status: 410, retryable: false },
  COMPANY_READ_ONLY: { status: 423, retryable: false },
  COMPANY_LOCKED: { status: 423, retryable: false },
  PROJECT_READ_ONLY: { status: 423, retryable: false },
  ATTACHMENT_NOT_CLEAN: { status: 423, retryable: true },
  LEGAL_ACCEPTANCE_REQUIRED: { status: 428, retryable: false },
  VALIDATION_FAILED: { status: 422, retryable: false },
  DEPENDENCY_CYCLE: { status: 422, retryable: false },
  WORKFLOW_TRANSITION_INVALID: { status: 422, retryable: false },
  SCHEDULE_PREVIEW_STALE: { status: 409, retryable: true },
  STRUCTURE_REVISION_CONFLICT: { status: 409, retryable: true },
  RATE_LIMITED: { status: 429, retryable: true },
  /** Not in §19.8's table: the catch-all for an unexpected server fault. Kept
   *  separate so an unmapped throw can never masquerade as a business error. */
  INTERNAL_ERROR: { status: 500, retryable: true },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type FieldError = { path: string; code: string; message: string };

export class NestoError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: FieldError[];
  /** Never serialized to the caller. Carries why the error really happened, for
   *  the audit trail and the log, when the public message is deliberately
   *  vague (a scope miss reported as NOT_FOUND, for instance). */
  readonly internalReason?: string;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { fieldErrors?: FieldError[]; internalReason?: string; meta?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "NestoError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors ?? [];
    this.internalReason = options?.internalReason;
    this.meta = options?.meta;
  }

  get status(): number {
    return ERROR_CODES[this.code].status;
  }

  get retryable(): boolean {
    return ERROR_CODES[this.code].retryable;
  }
}

/**
 * The only way a scope miss should ever leave a repository. Takes the real
 * reason for the log and gives the caller the non-disclosing one (§6.3, §19.3).
 */
export function notFoundInScope(what: string, internalReason: string): NestoError {
  return new NestoError("NOT_FOUND", `${what} was not found.`, { internalReason });
}

export function forbidden(permissionKey: string, internalReason?: string): NestoError {
  return new NestoError("FORBIDDEN", "You do not have permission to perform this action.", {
    internalReason: internalReason ?? `missing permission: ${permissionKey}`,
    meta: { permissionKey },
  });
}

export function validationFailed(fieldErrors: FieldError[], message = "The submitted data is not valid."): NestoError {
  return new NestoError("VALIDATION_FAILED", message, { fieldErrors });
}

export function versionConflict(expected: number, actual: number): NestoError {
  return new NestoError("CONFLICT", "This record changed since you loaded it. Reload and try again.", {
    meta: { expectedVersion: expected, actualVersion: actual },
  });
}
