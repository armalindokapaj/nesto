# Nesto — working agreements

## The requirement authority

`docs/prd/Nesto_Master_Architecture_PRD_v1.0.md` is the specification. Its §0.1 precedence order governs
conflicts, and §0.2 defines what MUST/SHOULD/MAY mean here. A material ambiguity is **not** resolved
silently in code — it becomes a product decision or an ADR first.

`docs/ENGINEERING-RESPONSE.md` records what was challenged, who owns what, and the eight declared
deviations. `docs/adr/` holds the decisions. Read ADR-0002, ADR-0004 and ADR-0005 before writing any
data access — they constrain nearly every line.

## This is NOT the Next.js you know

Next.js 16 has breaking changes from earlier versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices. In particular:
`middleware.ts` is now `proxy.ts`; `fetch` is uncached by default; caching is the `use cache` directive
with Cache Components, not `fetch` options.

## Hard rules

1. **No domain writes another domain's tables.** Cross-domain behavior goes through the owner's
   application service, its published query contract, or a registered event.
2. **Every repository method takes an `ExecutionContext` first.** There is no unscoped query surface.
3. **The browser never reaches the database.** Company Web and Platform Admin render on the server and
   call the API; the API is the only thing holding a Prisma client.
4. **Money is `Money`.** Never a `number`, never a bare `Decimal`, never arithmetic operators.
5. **Issued, posted, submitted and sent records are immutable.** Correct by reversal or new revision.
6. **Audit is append-only.** It is never deleted with the record it describes.
7. **A feature is not done** until its authorization, tenant validation, audit, concurrency, events,
   projections, failure recovery and tests exist (PRD final directive).
