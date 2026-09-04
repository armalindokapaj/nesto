# ADR-0012 — Tree/graph storage and revision strategy

**Status:** Accepted · 2026-09-04 · PRD §12.4, §12.5, §12.7, §12.12, Appendix D.12

## Context
Project Core has two independent trees (physical, WBS) and one dependency graph. They need cheap subtree
reads, safe moves, cycle prevention and optimistic concurrency at the *structure* level rather than the
row level.

## Decision
- **Trees: adjacency list plus materialized path.** Each node stores `parentId`, `path` (a `/`-joined
  chain of node IDs), `depth` and `sortKey`. Subtree read is `WHERE path <@ ancestor.path` semantics via a
  prefix index; parent integrity is the FK. Materialized path is maintained by the domain, never by a
  trigger, so it stays inside the audited unit of work.
- **Move validation:** target must be in the same project, allowed by the node type's parent rules, within
  max depth, and must not be a descendant of the moved node (checked by path prefix — the cycle test is a
  string comparison, not a recursive query).
- **Structure revision.** `ProjectPlanState` holds `structureRevision` (physical), `wbsRevision`,
  `graphRevision` and `taskRevision`. Every structural mutation bumps the relevant counter inside the
  transaction. Clients send the revision they read; a mismatch is `STRUCTURE_REVISION_CONFLICT` (409).
  This is why a tree edit does not need to lock every affected row.
- **Large moves** run as idempotent jobs against a captured revision and re-verify it on apply (§12.4).
- **Dependency graph:** edge rows `(predecessorId, successorId, type, lag, lagBasis)`. Cycle detection is a
  bounded DFS over the project's edges inside the write transaction; a cycle returns `DEPENDENCY_CYCLE`
  (422). A unique index on `(project_id, predecessor_id, successor_id)` prevents duplicates.
- **Schedule preview** stores the proposed changes, the source `graphRevision`/`taskRevision`/calendar
  version, a payload hash, the actor and an expiry. Apply re-checks all of them and is atomic; a mismatch
  is `SCHEDULE_PREVIEW_STALE` (409). No date ever moves without an applied preview (§12.7).
- **Baselines** capture the exact tree, graph and task revisions and are immutable thereafter.

## Consequences
- Reads are one indexed query; writes pay path maintenance on the moved subtree only.
- Revision counters give a single, cheap concurrency token per structure, which is exactly the granularity
  §12.12 asks for.
