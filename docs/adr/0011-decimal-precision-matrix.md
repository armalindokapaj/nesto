# ADR-0011 — Decimal precision and rounding matrix

**Status:** Accepted · 2026-09-04 · PRD §11.5, §11.6, §26.4, Appendix D.11

## Context
The PRD mandates fixed-precision money with explicit currency and forbids Float. In a JavaScript runtime
the storage type is the easy half; the hard half is preventing an accidental coercion to `number`.

## Decision

**Storage.**

| Field family | Type | Note |
|---|---|---|
| Monetary amount | `NUMERIC(20,4)` | 4 dp holds unit prices and tax bases; presentation rounds to the currency's minor unit |
| Monetary total / aggregate | `NUMERIC(24,4)` | headroom for summation |
| Quantity | `NUMERIC(20,6)` | with a controlled UOM code (§11.6) |
| Unit price | `NUMERIC(20,6)` | rate-like, finer than an amount |
| Percentage / weight | `NUMERIC(9,6)` | 0–100 or 0–1 as documented per field |
| Exchange rate | `NUMERIC(20,10)` | with source, effective date, base/quote and rounding rule |

**Currency.** Every monetary column is accompanied by an ISO 4217 `currency` column, or inherits it from
an immutable same-currency aggregate root that declares it once. Mixed-currency totals stay grouped by
currency unless an approved, displayed conversion basis is applied (§11.5).

**Rounding.** Half-even (banker's) at presentation and at any point a value becomes a payable amount.
Allocation across shares uses largest-remainder so parts always sum to the total exactly.

**In code.** `packages/money` exports a `Money` value object: `{ amount: Decimal, currency: string }`, with
`plus/minus/times/allocate/compare`, no `valueOf`, no implicit coercion, and arithmetic that refuses two
different currencies. An ESLint rule bans `+ - * /` on `Prisma.Decimal` and on `Money`. API boundaries
serialize to a **decimal string** (§19.1); `JSON.parse` never produces a money `number`.

**Testing.** Property tests for associativity of allocation, reversal-not-edit, allocation ceilings,
mixed-currency separation and duplicate-posting idempotency (§26.4).

## Consequences
- The 2 dp/4 dp distinction is deliberate: storing only 2 dp loses tax and unit-price precision that
  construction commerce actually uses.
- `Decimal` arithmetic is slower than `number`. Irrelevant at these volumes; correctness is not optional.
