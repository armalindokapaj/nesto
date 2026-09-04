/**
 * The request-scoped database context.
 *
 * Held in AsyncLocalStorage rather than threaded through every call because it
 * has to reach the Prisma client extension, which sits below every repository
 * and cannot be given an argument. The ExecutionContext is still an explicit
 * first parameter on every repository method (ADR-0005) — this store is how the
 * *enforcement layer* sees the same context, not a substitute for passing it.
 *
 * Absence is a failure, not a default. A query issued with no scope in the store
 * throws, which is what "deny by default" has to mean at the data layer.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { ExecutionContext } from "@nesto/contracts";
import type { Prisma } from "../generated/prisma";

export type PrismaTx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type DbScope = {
  ctx: ExecutionContext;
  /** True inside a read-only transaction; write operations are rejected early
   *  with a clear message instead of a Postgres error 25006. */
  readOnly: boolean;
  /** Set by seeds, migrations and the outbox relay, which legitimately operate
   *  across tenants. Never set from a request path. */
  unscoped: boolean;
};

export const scopeStorage = new AsyncLocalStorage<DbScope>();

export function currentScope(): DbScope | undefined {
  return scopeStorage.getStore();
}

export function requireScope(operation: string): DbScope {
  const scope = scopeStorage.getStore();
  if (!scope) {
    throw new Error(
      `Database operation "${operation}" ran with no execution context. ` +
        `Wrap it in readScope() or unitOfWork() — an unscoped query is never allowed.`
    );
  }
  return scope;
}
