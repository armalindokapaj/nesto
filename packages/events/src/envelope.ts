/**
 * The canonical event envelope — PRD §20.1, field for field.
 *
 * Two constraints do most of the work here:
 *   1. An event is a *completed fact*, past tense, never a command (§20.2). A
 *      consumer that receives `work_item.status.changed.v1` cannot refuse it;
 *      it already happened.
 *   2. The payload carries only what a registered consumer needs (§20.1). A
 *      confidential record snapshot never travels in an event — a consumer that
 *      needs protected detail calls the owner's query contract under its own
 *      identity and permission.
 */

import { z } from "zod";

export const eventActorSchema = z.object({
  type: z.enum(["USER", "PLATFORM_ADMIN", "EXTERNAL_USER", "SYSTEM"]),
  id: z.string(),
});

export const eventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().regex(/^[a-z_]+\.[a-z_]+(\.[a-z_]+)*\.v\d+$/),
  schemaVersion: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  producer: z.string(),
  tenantId: z.string().uuid(),
  owningCompanyId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  aggregateType: z.string(),
  aggregateId: z.string().uuid(),
  aggregateVersion: z.number().int().nonnegative(),
  actor: eventActorSchema,
  correlationId: z.string(),
  causationId: z.string().nullable().optional(),
  data: z.record(z.unknown()),
});

export type EventEnvelope<TData = Record<string, unknown>> = Omit<
  z.infer<typeof eventEnvelopeSchema>,
  "data"
> & { data: TData };

/**
 * `<domain>.<aggregate-or-capability>.<past-tense-action>.vN` (§20.2).
 *
 * The PRD's own §20.7 catalogue includes three-segment names — `rfi.opened.v1`,
 * `baseline.completed.v1`, `schedule.applied.v1` — where the domain and the
 * aggregate are the same word and saying it twice would be noise. Those are
 * parsed with capability equal to domain rather than rejected.
 */
export function parseEventType(eventType: string): { domain: string; capability: string; action: string; version: number } {
  const match = /^([a-z_]+)((?:\.[a-z_]+)*)\.([a-z_]+)\.v(\d+)$/.exec(eventType);
  if (!match) throw new Error(`"${eventType}" does not follow <domain>[.<capability>].<action>.vN.`);
  const domain = match[1] as string;
  const middle = (match[2] as string).replace(/^\./, "");
  return { domain, capability: middle === "" ? domain : middle, action: match[3] as string, version: Number(match[4]) };
}

/** Deterministic serialization, so the audit hash chain and the outbox payload
 *  agree byte for byte regardless of key insertion order. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}
