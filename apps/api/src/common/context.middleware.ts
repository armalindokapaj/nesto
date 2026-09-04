/**
 * Establishes the request's ExecutionContext and its log/metric bindings.
 *
 * Runs before everything. Every downstream layer — guards, controllers,
 * repositories — reads the context from AsyncLocalStorage rather than being
 * handed it, which is what lets the database layer refuse a query that has none
 * (ADR-0005).
 */

import { Injectable, NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { httpDuration, httpRequests, logger } from "@nesto/observability";
import { newId } from "@nesto/database";
import { buildContext, publicContext, runWithContext } from "./request-context";

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest["raw"] & { headers: Record<string, string | string[] | undefined> }, res: FastifyReply["raw"], next: () => void): void {
    const headers = req.headers;
    const requestId = header(headers, "x-request-id") ?? newId();
    // Accepted from the caller so one id traces a flow that began in the web
    // tier; a fresh one when there is none.
    const correlationId = header(headers, "x-correlation-id") ?? requestId;
    const locale = header(headers, "x-locale") === "sq" ? "sq" : "en";

    const ctx = publicContext(correlationId, locale);
    const withRequestId = { ...ctx, requestId };
    const started = process.hrtime.bigint();

    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);

    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1_000_000;
      const route = (req as { url?: string }).url?.split("?")[0] ?? "unknown";
      httpRequests({ route, method: (req as { method?: string }).method, status: res.statusCode, audience: withRequestId.audience });
      httpDuration(ms, { route, method: (req as { method?: string }).method });
      if (ms > 500) {
        // The internal p95 budget is 120 ms for a list endpoint; anything over
        // half a second is worth a line in the log while it is still cheap to fix.
        logger.warn("request.slow", { requestId, route, ms: Math.round(ms) });
      }
    });

    void runWithContext(withRequestId, async () => next());
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export { buildContext };
