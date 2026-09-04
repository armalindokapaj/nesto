/**
 * The database package's public surface.
 *
 * Note what is NOT here: the generated PrismaClient. Domain code cannot import
 * it, which is what makes "every query is scoped" enforceable rather than
 * aspirational (ADR-0005). An architecture test fails the build on any import
 * of `./generated/prisma` from outside this package.
 */

export { db, Prisma, type ScopedDb } from "./client";
export { readScope, unitOfWork, unscopedScope, disconnect } from "./unit-of-work";
export type { UnitOfWork, AuditEntry, OutboxEmit, ActivityEntry, TransactionalDb, ScopeOptions } from "./unit-of-work";
export { newId, idCreatedAt, isUuid, shortRef } from "./id";
export { currentScope, type DbScope } from "./scope";
export { updateWithVersion, transitionState, bumpRevision } from "./concurrency";
export type { VersionedUpdate } from "./concurrency";
