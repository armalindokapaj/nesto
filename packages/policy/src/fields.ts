/**
 * Field and section security — PRD §8.5, ADR-0004.
 *
 * A route permission is not enough for finance amounts, salary, medical notes,
 * bid values or private notes. The rule that makes this work is order: the
 * decision produces a field allowlist, and the repository selects exactly those
 * columns. Prohibited data is never loaded, so it cannot leak through a log
 * line, a serializer that forgot to omit it, or an error payload that echoes
 * the row.
 */

import type { PolicyDecision } from "@nesto/contracts";
import { evaluate, type PolicySubject } from "./engine";

export type FieldRule = {
  /** Fields anyone with the base read permission may see. */
  base: string[];
  /** Extra fields, each unlocked by its own permission key. */
  guarded: Record<string, string>;
};

export function resolveFields(subject: PolicySubject, readKey: string, rule: FieldRule): PolicyDecision {
  const decision = evaluate(subject, readKey);
  if (!decision.allow) return decision;

  const fields = new Set(rule.base);
  const reasons = [...decision.reasons];

  for (const [field, permission] of Object.entries(rule.guarded)) {
    if (evaluate(subject, permission).allow) fields.add(field);
    else reasons.push(`field-withheld:${field}`);
  }

  return { allow: true, fields, reasons };
}

/**
 * Turn an allowlist into a Prisma `select`. The point of returning a select
 * rather than filtering afterwards: what is not selected is not read.
 */
export function toSelect(fields: ReadonlySet<string> | undefined, fallback: string[]): Record<string, true> {
  const list = fields ? [...fields] : fallback;
  return Object.fromEntries(list.map((f) => [f, true as const]));
}

/**
 * Strip anything the decision did not allow, for a payload assembled from
 * somewhere other than a database row — a projection, a cached read model.
 * The select-first path is preferred; this exists so the second path is not
 * simply unguarded.
 */
export function applyFieldPolicy<T extends Record<string, unknown>>(
  record: T,
  decision: PolicyDecision
): Partial<T> {
  if (!decision.allow) return {};
  if (!decision.fields) return record;
  const out: Partial<T> = {};
  for (const key of Object.keys(record)) {
    if (decision.fields.has(key)) out[key as keyof T] = record[key as keyof T];
  }
  return out;
}
