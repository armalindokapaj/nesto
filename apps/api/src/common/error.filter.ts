/**
 * The §19.3 error envelope.
 *
 * Two rules do the work:
 *   1. Never reveal whether an unauthorized record exists. A scope miss is
 *      already a NestoError("NOT_FOUND") by the time it arrives; the internal
 *      reason goes to the log and the audit trail, never to the caller.
 *   2. An unmapped throw is `INTERNAL_ERROR`, with its message discarded. A
 *      Prisma error string can carry a table name, a column, sometimes a value.
 */

import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { NestoError, type ErrorEnvelope } from "@nesto/contracts";
import { logger } from "@nesto/observability";
import { currentContext } from "./request-context";

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const ctx = currentContext();
    const requestId = ctx?.requestId ?? "unknown";

    if (exception instanceof NestoError) {
      // A denial is evidence: §25.3 counts these, because a rising deny rate on
      // cross-scope ids is what an attack looks like from the inside.
      logger.warn("request.denied", {
        requestId,
        correlationId: ctx?.correlationId,
        code: exception.code,
        permission: exception.meta?.["permissionKey"],
        internalReason: exception.internalReason,
      });
      void reply.status(exception.status).send(envelope(exception, requestId));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = status === 404 ? "NOT_FOUND" : status === 401 ? "AUTH_INVALID" : status === 403 ? "FORBIDDEN" : "VALIDATION_FAILED";
      void reply.status(status).send({
        error: { code, message: exception.message, fieldErrors: [], requestId, retryable: false },
      } satisfies ErrorEnvelope);
      return;
    }

    logger.error("request.failed", {
      requestId,
      correlationId: ctx?.correlationId,
      error: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : String(exception),
    });

    void reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        // Deliberately generic. The detail is in the log, keyed by requestId.
        message: "Something went wrong. Quote this request id to support.",
        fieldErrors: [],
        requestId,
        retryable: true,
      },
    } satisfies ErrorEnvelope);
  }
}

function envelope(error: NestoError, requestId: string): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
      requestId,
      retryable: error.retryable,
    },
  };
}
