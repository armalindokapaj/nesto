/**
 * The canonical aggregate contract of PRD §11.2.
 *
 * Two ideas here are easy to conflate and must not be:
 *   - `lifecycleStatus` is the *business* state (DRAFT, ISSUED, POSTED…).
 *   - `archivedAt` is a *technical* state. Archiving an ACTIVE contract does not
 *     make it a draft; it removes it from default listings and nothing else.
 *
 * `recordVersion` is the optimistic-concurrency token for a single row.
 * Structures and graphs get their own counters instead (ADR-0012), because
 * locking every node of a 5 000-node tree to move one branch is not a design.
 */

export type Confidentiality = "PUBLIC" | "INTERNAL" | "RESTRICTED" | "CONFIDENTIAL";

export type AggregateRoot = {
  id: string;
  tenantId: string;
  owningCompanyId?: string;
  projectId?: string;
  code?: string;
  lifecycleStatus: string;
  recordVersion: number;
  confidentiality?: Confidentiality;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  archivedAt?: Date | null;
  archivedBy?: string | null;
  sourceSystem?: string | null;
  importBatchId?: string | null;
};

/** Cross-domain reference contract, §11.4. The revision is mandatory wherever
 *  business meaning depends on *which* version was referenced — an approval
 *  against "the drawing" is meaningless; it is always against Rev 03. */
export type CrossDomainRef = {
  sourceDomain: string;
  targetType: string;
  targetId: string;
  targetRevision?: string | number;
};

/** Concurrency guards, §12.12. Each mutation class declares which it uses. */
export type ConcurrencyGuard =
  | { kind: "RECORD"; recordVersion: number }
  | { kind: "STRUCTURE"; structureRevision: number }
  | { kind: "GRAPH"; graphRevision: number }
  | { kind: "PREVIEW"; previewToken: string }
  | { kind: "CALENDAR"; calendarVersion: number; graphRevision: number }
  | { kind: "IMPORT"; validationHash: string };
