/**
 * The §19.2 success envelope.
 *
 * Every response is `{ data, meta }`. `meta` is where a response tells the
 * truth about itself — its requestId, its cursor, and for a projection its
 * source version and freshness (§19.5, §22.2). A handler that wants to control
 * meta returns an `Enveloped`; anything else is wrapped.
 */

import { CallHandler, ExecutionContext as NestContext, Injectable, NestInterceptor, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map, Observable } from "rxjs";
import type { ResponseMeta } from "@nesto/contracts";
import { requireContext } from "./request-context";

export type Enveloped<T> = { data: T; meta?: Partial<ResponseMeta> };

const ENVELOPE = Symbol.for("nesto.enveloped");

/**
 * Opt a route out of the envelope.
 *
 * For the handful of endpoints whose consumer is not a Nesto client and cannot
 * be given one: Prometheus scraping /metrics wants text, and a file download
 * wants bytes. Everything a client of this API calls stays enveloped.
 */
export const SKIP_ENVELOPE = "nesto:skip-envelope";
export const SkipEnvelope = (): MethodDecorator => SetMetadata(SKIP_ENVELOPE, true);

export function enveloped<T>(data: T, meta: Partial<ResponseMeta> = {}): Enveloped<T> {
  return Object.assign({ data, meta }, { [ENVELOPE]: true });
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: NestContext, next: CallHandler): Observable<unknown> {
    if (this.reflector.get<boolean>(SKIP_ENVELOPE, context.getHandler())) {
      return next.handle();
    }
    return next.handle().pipe(
      map((payload) => {
        const ctx = requireContext();
        if (payload && typeof payload === "object" && ENVELOPE in payload) {
          const e = payload as Enveloped<unknown>;
          return { data: e.data, meta: { requestId: ctx.requestId, ...e.meta } };
        }
        return { data: payload ?? null, meta: { requestId: ctx.requestId } };
      })
    );
  }
}
