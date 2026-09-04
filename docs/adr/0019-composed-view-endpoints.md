# ADR-0019 — Composed page-view endpoints

**Status:** Accepted · 2026-09-04 · Deviation D-8 · PRD §19.6, §22.3, §25.1

## Context
The PRD mandates a NestJS API as the authoritative transport and the Product Owner adopted it literally,
while also stating that platform speed is crucial. §22.3 requires each dashboard widget to have its own
query contract and permission. Taken naively, a 12-widget dashboard rendered server-side becomes 12
sequential network round trips before the first byte reaches the user.

## Decision
- Add a read-only namespace **`/api/v1/views/*`** to the API surface of §19.6. A view endpoint composes the
  widget queries for exactly one screen and returns them in one response.
- **A view composes; it never re-implements.** It calls the same domain query contracts the individual
  widget endpoints call, so there is one implementation of each query and one permission decision per
  widget, evaluated independently. A widget the caller may not see is absent from the payload and the rest
  of the response still renders — §22.3's degrade-by-widget rule.
- **Views are never a write path** and never accept mutations.
- Each widget's slice carries its own `sourceVersion`/`freshness` so the frontend can render staleness per
  widget (§19.2, §22.2).
- Widget endpoints remain published for partial refresh, polling and external consumers.
- Company Web calls views from the server over a keep-alive agent; the browser makes no data round trip for
  first paint.

## Consequences
- One hop per screen instead of N, which is what brings server-rendered pages inside the ≤ 350 ms TTFB
  budget with the mandated API tier in place.
- A view is an additional surface to keep in step with its widgets. Mitigated by composition rather than
  duplication, and by a test asserting a view's slice equals its widget endpoint's payload.
