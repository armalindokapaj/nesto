/**
 * Building the ExecutionContext — PRD §6.2.
 *
 * The rule that shapes this file: a client-supplied tenant, company or project
 * identifier is a *selection request*, never a fact. Every one of them is
 * validated against the caller's live identity, membership, relationship and
 * company lifecycle before a context exists at all. Nothing downstream has to
 * re-check, because nothing downstream can be reached without one.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { ExecutionContext, Audience, Locale } from "@nesto/contracts";
import { newId } from "@nesto/database";

const storage = new AsyncLocalStorage<ExecutionContext>();

export function runWithContext<T>(ctx: ExecutionContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentContext(): ExecutionContext | undefined {
  return storage.getStore();
}

export function requireContext(): ExecutionContext {
  const ctx = storage.getStore();
  if (!ctx) throw new Error("No execution context on this request.");
  return ctx;
}

export type ContextSeed = {
  audience: Audience;
  actorType: ExecutionContext["actorType"];
  actorId: string;
  /** Already validated against live membership by the auth guard. */
  tenantId?: string;
  activeCompanyId?: string;
  activeProjectId?: string;
  membershipId?: string;
  externalOrganizationId?: string;
  sessionId?: string;
  locale?: Locale;
  /** Propagated from the caller when present, so one id traces a flow that
   *  crosses the web tier, the API, a queue and an event consumer (§28.23). */
  correlationId?: string;
  requestId?: string;
};

export function buildContext(seed: ContextSeed): ExecutionContext {
  const requestId = seed.requestId ?? newId();
  return {
    requestId,
    correlationId: seed.correlationId ?? requestId,
    actorType: seed.actorType,
    actorId: seed.actorId,
    audience: seed.audience,
    tenantId: seed.tenantId,
    activeCompanyId: seed.activeCompanyId,
    activeProjectId: seed.activeProjectId,
    membershipId: seed.membershipId,
    externalOrganizationId: seed.externalOrganizationId,
    sessionId: seed.sessionId,
    locale: seed.locale ?? "en",
    // Fixed for the whole operation: two reads inside one command must not
    // disagree about what "now" means.
    now: new Date().toISOString(),
  };
}

/** The anonymous public context, for sign-in, the public network and portals
 *  before a session exists. */
export function publicContext(correlationId?: string, locale: Locale = "en"): ExecutionContext {
  return buildContext({
    audience: "PUBLIC",
    actorType: "USER",
    actorId: "00000000-0000-0000-0000-000000000000",
    locale,
    correlationId,
  });
}
