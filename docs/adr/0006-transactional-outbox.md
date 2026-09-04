# ADR-0006 — Transactional outbox and consumer idempotency

**Status:** Accepted · 2026-09-04 · PRD §20.3–§20.6, Appendix D.6

## Context
A cross-domain fact must never be committed without its event, nor an event published for a fact that
rolled back. Delivery is at-least-once, so every consumer must tolerate duplicates and reordering.

## Decision
- **Outbox.** `integration.outbox_event` is written in the same transaction as the business change.
  Columns: event id/type/schema version, tenant/company/project, aggregate type/id/version, payload,
  `createdAt`, `status`, `attempts`, `nextAttemptAt`, `publishedAt`. Index on
  `(status, next_attempt_at)` per §11.8.
- **Relay.** A BullMQ worker claims batches with `FOR UPDATE SKIP LOCKED`, publishes, and marks
  published. Exponential backoff with jitter; exhaustion moves the row to `integration.dead_letter`.
- **Inbox.** `integration.inbox_message` is unique on `(consumer, event_id)`; a consumer's first action is
  to claim, and a duplicate claim short-circuits the handler. This is what makes at-least-once safe.
- **Ordering.** Per-aggregate only. Consumers that maintain a projection compare `aggregateVersion` and
  ignore an older one; a *gap* schedules reconciliation rather than blocking the stream (§20.5).
- **Checkpoints.** `integration.consumer_checkpoint` records progress per consumer for observability and
  for replay bounds.
- **Replay.** Permissioned, reasoned and audited; revalidates schema, scope and obsolescence, and cannot
  re-fire an external side effect already confirmed (§20.6).
- Consumers never write the source domain's tables (§20.4).

## Consequences
- Business correctness never depends on the broker being up: the fact and its intent-to-publish are one
  commit, and the relay catches up.
- Handlers must be written idempotently even with the inbox, because the inbox protects the *claim*, not
  a partially-completed handler; handlers are therefore required to be re-runnable to completion.
