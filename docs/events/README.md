# Event and schema registry

Envelope: PRD §20.1, implemented in `packages/events`. Naming:
`<domain>.<aggregate-or-capability>.<past-tense-action>.vN`.

A published `(type, version)` pair's meaning is **immutable**. Additive optional fields may be added to an
existing version; anything else is a new version. CI compares every event schema against the committed
registry and fails on an incompatible change. An unsupported version dead-letters — it is never silently
ignored (§20.2).

Each event has a JSON Schema at `docs/events/schemas/<type>.<version>.json`, generated from the Zod
definition, and a row in `docs/events/registry.csv` naming its producer and registered consumers.

## Baseline catalogue (PRD §20.7)

| Event | Producer |
|---|---|
| `company.lifecycle.changed.v1` | foundation |
| `company.verification.changed.v1` | network |
| `membership.changed.v1` | organization |
| `permission.changed.v1` | authorization |
| `project.state.changed.v1` | projects |
| `project.member.changed.v1` | projects |
| `physical.structure.changed.v1` | project-core |
| `wbs.structure.changed.v1` | project-core |
| `work_item.changed.v1` | tasks |
| `work_item.status.changed.v1` | tasks |
| `schedule.applied.v1` | project-core |
| `baseline.completed.v1` | project-core |
| `document.revision.issued.v1` | documents |
| `rfi.opened.v1` | design-control |
| `rfi.responded.v1` | design-control |
| `submittal.decision.recorded.v1` | design-control |
| `variation.state.changed.v1` | design-control |
| `contract.activated.v1` | contracts |
| `budget.approved.v1` | finance |
| `invoice.posted.v1` | finance |
| `payment.posted.v1` | finance |
| `purchase_order.issued.v1` | procurement |
| `goods_receipt.posted.v1` | inventory |
| `stock.movement.posted.v1` | inventory |
| `progress.measurement.approved.v1` | work-progress |
| `inspection.completed.v1` | qaqc |
| `hse.incident.reported.v1` | hse |
| `external.scope.changed.v1` | network |
| `correspondence.sent.v1` | network |
| `job.application.stage.changed.v1` | jobs |
| `tender.bid.submitted.v1` | tenders |
| `tender.preferred_bidder.approved.v1` | tenders |
| `workflow.outcome.reached.v1` | workflow |

## Payload rule

Events carry only what a registered consumer needs. A confidential record snapshot never travels in an
event (§20.1); consumers that need protected detail call the owner's query contract under their own
service identity and permission.
