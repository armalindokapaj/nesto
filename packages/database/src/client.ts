/**
 * The scoped Prisma client — ADR-0005.
 *
 * The generated client is never exported from this package. What leaves is a
 * client whose every model query has already had the caller's tenant, company
 * and project predicates merged in, and which refuses to run at all when there
 * is no execution context.
 *
 * This is the *first* barrier. Postgres RLS (ADR-0002) is the second. The
 * reason to have both is that they fail differently: a bug here produces a
 * thrown error in development, while a bug that somehow reached production
 * produces an empty result set instead of another tenant's data.
 */

import { PrismaClient, Prisma } from "../generated/prisma";
import { requireScope, scopeStorage, type DbScope } from "./scope";

/**
 * Which scope columns each model carries, derived from the DMMF at load time
 * rather than maintained by hand. A model that gains a `projectId` in a later
 * migration is scoped by it automatically, with no list to remember to update.
 */
type ModelScope = { tenant: boolean; company: boolean; project: boolean };

const MODEL_SCOPES: Map<string, ModelScope> = new Map(
  Prisma.dmmf.datamodel.models.map((model) => {
    const names = new Set(model.fields.map((f) => f.name));
    return [
      model.name,
      {
        tenant: names.has("tenantId"),
        company: names.has("owningCompanyId"),
        project: names.has("projectId"),
      },
    ] as const;
  })
);

/** Models whose `tenantId` is nullable: platform-scope rows legitimately have
 *  none, so scoping must allow NULL through in the platform audience only. */
const NULLABLE_TENANT: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId" && !f.isRequired))
    .map((m) => m.name)
);

const READ_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy",
]);

const WRITE_OPERATIONS = new Set([
  "create", "createMany", "createManyAndReturn", "update", "updateMany",
  "upsert", "delete", "deleteMany",
]);

function scopePredicate(model: string, scope: DbScope): Record<string, unknown> {
  const shape = MODEL_SCOPES.get(model);
  const ctx = scope.ctx;
  const where: Record<string, unknown> = {};
  if (!shape) return where;

  if (shape.tenant && ctx.tenantId) {
    where["tenantId"] = NULLABLE_TENANT.has(model) ? { in: [ctx.tenantId] } : ctx.tenantId;
  }
  // Company and project narrowing is applied only when the context actually has
  // one. A company-wide query issued by a user with no active project must not
  // be silently narrowed to nothing.
  if (shape.company && ctx.activeCompanyId) where["owningCompanyId"] = ctx.activeCompanyId;
  if (shape.project && ctx.activeProjectId) where["projectId"] = ctx.activeProjectId;
  return where;
}

function assertScopeOnData(model: string, data: Record<string, unknown>, scope: DbScope): void {
  const shape = MODEL_SCOPES.get(model);
  const ctx = scope.ctx;
  if (!shape) return;

  // A write that names a foreign tenant is not corrected silently — it is the
  // signature of a cross-tenant reference attack (threat T2) and must be loud.
  if (shape.tenant && ctx.tenantId) {
    if (data["tenantId"] === undefined) data["tenantId"] = ctx.tenantId;
    else if (data["tenantId"] !== null && data["tenantId"] !== ctx.tenantId) {
      throw new Error(
        `Refusing to write ${model} with tenantId ${String(data["tenantId"])} from a context scoped to ${ctx.tenantId}.`
      );
    }
  }
  if (shape.company && ctx.activeCompanyId) {
    if (data["owningCompanyId"] === undefined) data["owningCompanyId"] = ctx.activeCompanyId;
    else if (data["owningCompanyId"] !== null && data["owningCompanyId"] !== ctx.activeCompanyId) {
      throw new Error(
        `Refusing to write ${model} with owningCompanyId ${String(data["owningCompanyId"])} from a context scoped to ${ctx.activeCompanyId}.`
      );
    }
  }
  if (shape.project && ctx.activeProjectId && data["projectId"] === undefined) {
    data["projectId"] = ctx.activeProjectId;
  }
}

function mergeWhere(existing: unknown, scoped: Record<string, unknown>): unknown {
  if (Object.keys(scoped).length === 0) return existing;
  if (!existing || typeof existing !== "object") return scoped;
  // AND rather than spread: a caller who already filtered on tenantId keeps
  // their filter, and both must hold. Spreading would let the caller's value win.
  return { AND: [existing, scoped] };
}

function createBaseClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env["NODE_ENV"] === "production"
        ? [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }]
        : [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }],
  });
}

const base = createBaseClient();

export const db = base.$extends({
  name: "nesto-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const scope = requireScope(`${model}.${operation}`);

        // Seeds, migrations and the outbox relay legitimately span tenants.
        // Never set from a request path — see unitOfWork/readScope.
        if (scope.unscoped) return query(args);

        if (scope.readOnly && WRITE_OPERATIONS.has(operation)) {
          throw new Error(
            `${model}.${operation} attempted inside a read-only scope. Use unitOfWork() for writes.`
          );
        }

        const scoped = scopePredicate(model, scope);
        const next = args as Record<string, unknown>;

        if (READ_OPERATIONS.has(operation) || operation === "updateMany" || operation === "deleteMany") {
          next["where"] = mergeWhere(next["where"], scoped);
        } else if (operation === "update" || operation === "delete") {
          // Prisma allows non-unique filters alongside a unique one, so the
          // scope narrows the row that gets updated rather than merely checking
          // it afterwards: a foreign id yields "record not found", not a write.
          next["where"] = { ...(next["where"] as object), ...scoped };
        } else if (operation === "create") {
          assertScopeOnData(model, next["data"] as Record<string, unknown>, scope);
        } else if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = next["data"];
          for (const row of Array.isArray(data) ? data : [data]) {
            assertScopeOnData(model, row as Record<string, unknown>, scope);
          }
        } else if (operation === "upsert") {
          next["where"] = { ...(next["where"] as object), ...scoped };
          assertScopeOnData(model, next["create"] as Record<string, unknown>, scope);
        }

        return query(next);
      },
    },
  },
});

export type ScopedDb = typeof db;

/** Escape hatch for this package only: migrations, seeds, RLS setup and the
 *  relay. Deliberately not re-exported from the package index. */
export const rawClient = base;

export { Prisma, scopeStorage };
export type { PrismaClient };
