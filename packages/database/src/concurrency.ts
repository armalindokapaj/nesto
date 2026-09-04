/**
 * Optimistic concurrency — PRD §12.12, §19.1.
 *
 * Every mutable aggregate carries `recordVersion`. A client sends the version it
 * read (as `If-Match`), and the update only lands if the row is still at that
 * version.
 *
 * The implementation is a **conditional updateMany**, not read-then-write:
 *
 *     UPDATE ... SET ..., recordVersion = recordVersion + 1
 *     WHERE id = $1 AND recordVersion = $2
 *
 * One statement, so the check and the write are atomic under READ COMMITTED
 * with no lock held across a round trip. Reading the row first and comparing in
 * TypeScript has a window between the read and the write in which another
 * transaction can commit, and that window is exactly where lost updates live.
 *
 * `count === 0` is deliberately ambiguous — the row may be at another version,
 * or may not exist in this scope at all. The caller resolves it with one extra
 * scoped read, which is also how a foreign id ends up reported as NOT_FOUND
 * rather than CONFLICT (§19.3: never confirm that another tenant's row exists).
 */

import { NestoError, notFoundInScope, versionConflict } from "@nesto/contracts";
import type { TransactionalDb } from "./unit-of-work";

/** Models that carry `recordVersion`, keyed by the Prisma delegate name. */
type VersionedDelegate = {
  updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
  findFirst: (args: { where: Record<string, unknown>; select: Record<string, boolean> }) => Promise<{ recordVersion: number } | null>;
};

export type VersionedUpdate = {
  id: string;
  expectedVersion: number;
  data: Record<string, unknown>;
  /** Named in the NOT_FOUND message the caller sees, e.g. "Contract". */
  label: string;
};

export async function updateWithVersion(
  delegate: VersionedDelegate,
  update: VersionedUpdate
): Promise<number> {
  const nextVersion = update.expectedVersion + 1;
  const { count } = await delegate.updateMany({
    where: { id: update.id, recordVersion: update.expectedVersion },
    data: { ...update.data, recordVersion: nextVersion },
  });

  if (count === 1) return nextVersion;

  // Nothing matched. Distinguish "changed underneath you" from "not yours",
  // and report the second one as absence.
  const current = await delegate.findFirst({
    where: { id: update.id },
    select: { recordVersion: true },
  });
  if (!current) {
    throw notFoundInScope(update.label, `no ${update.label} ${update.id} visible in this scope`);
  }
  throw versionConflict(update.expectedVersion, current.recordVersion);
}

/**
 * A guarded state transition — the house pattern for anything with a lifecycle.
 *
 * The legal `from` states are part of the WHERE clause, so two concurrent
 * attempts to post the same invoice cannot both succeed: the second matches
 * zero rows. Checking the state in application code and then writing has the
 * same lost-update window as read-then-write, and on a finance posting that
 * window is a duplicate payment.
 */
export async function transitionState(
  delegate: VersionedDelegate,
  params: {
    id: string;
    from: string[];
    to: string;
    label: string;
    /** Extra columns to set as part of the same statement. */
    data?: Record<string, unknown>;
    statusField?: string;
  }
): Promise<void> {
  const field = params.statusField ?? "lifecycleStatus";
  const { count } = await delegate.updateMany({
    where: { id: params.id, [field]: { in: params.from } },
    data: { ...(params.data ?? {}), [field]: params.to },
  });

  if (count === 1) return;

  const current = (await delegate.findFirst({
    where: { id: params.id },
    select: { [field]: true } as Record<string, boolean>,
  })) as unknown as Record<string, string> | null;

  if (!current) {
    throw notFoundInScope(params.label, `no ${params.label} ${params.id} visible in this scope`);
  }
  throw new NestoError(
    "WORKFLOW_TRANSITION_INVALID",
    `This ${params.label.toLowerCase()} cannot move to ${params.to} from its current state.`,
    { internalReason: `state was ${String(current[field])}, expected one of ${params.from.join(", ")}` }
  );
}

/**
 * Structure and graph revisions (ADR-0012). Same conditional-write shape, but
 * the token guards a whole tree rather than one row — which is the point: moving
 * a branch of a 5 000-node tree must not require locking 5 000 rows.
 */
export async function bumpRevision(
  delegate: VersionedDelegate,
  params: { id: string; field: "structureRevision" | "wbsRevision" | "graphRevision" | "taskRevision"; expected: number; label: string }
): Promise<number> {
  const next = params.expected + 1;
  const { count } = await delegate.updateMany({
    where: { id: params.id, [params.field]: params.expected },
    data: { [params.field]: next },
  });
  if (count === 1) return next;

  throw new NestoError(
    "STRUCTURE_REVISION_CONFLICT",
    "The structure changed while you were editing it. Reload and reapply your change.",
    { internalReason: `${params.label} ${params.id}: ${params.field} was not ${params.expected}` }
  );
}
