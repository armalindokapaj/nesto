# Construction OS (Nesto) â PRD: Phase 9, Stale-Session API Routes v1.0

**Status:** Draft for implementation
**Owner:** Lindo (solo full-stack)
**Depends on:** Phase 7 (fixes `globalSearch()` itself; this phase fixes what feeds it a role)
**Scope:** four API route files â no new business modules.

---

## 0. What I found

Following up on Phase 8's closing note â checking whether page-level dashboard routing correctness actually holds at the API layer, not just the page layer â I checked every place an API route establishes who's calling it. `src/lib/dal.ts` deliberately provides two different functions for this, and the difference between them is the whole point of this phase:

- **`verifySession()`/`getCurrentUser()`** â re-reads `CompanyMembership` from the database on every call, so a role change, suspension, or removal takes effect on the very next request. This is the one `dal.ts`'s own comment calls out by name: *"Audit C2 â the JWT's role is a 7-day-stale snapshot from login time. The authoritative role is whatever CompanyMembership says right now."*
- **`peekSession()`** â decrypts the JWT cookie and returns whatever it says, with **no database check at all**. Its own doc comment is explicit about the intended use: *"Optimistic-only variant â never redirects. Use in places (e.g. the landing page) that need to know 'is someone logged in' without forcing a redirect."*

That distinction is exactly right, and it's used correctly almost everywhere â `src/app/api/documents/[id]/file/route.ts` and `src/app/api/units/export/route.ts` both correctly call `getCurrentUser()` before serving anything. But four routes use `peekSession()` to serve or scope real data anyway, which is precisely the case its own documentation says not to:

| # | Route | What it does with the unverified session |
|---|---|---|
| A | `src/app/api/search/route.ts` | Passes `session.role` straight into `globalSearch()` as the permission gate. Once Phase 7 lands, `globalSearch()`'s scoping will be correct â for whatever role the request claims. If an Owner demotes a `CLIENT` or changes someone's role, this endpoint keeps honoring the *old* role for up to 7 days, the exact staleness window `getCurrentUser()` exists to close everywhere else. |
| B | `src/app/api/notifications/route.ts` | Uses `session.tenantId`/`session.userId` to fetch notifications and unread count. |
| C | `src/app/api/notifications/[id]/read/route.ts` | Same, for marking one notification read. |
| D | `src/app/api/notifications/read-all/route.ts` | Same, for marking all read. |
| â | `src/app/layout.tsx` | Also uses `peekSession()`, but only to look up a display theme preference for rendering â no sensitive data, no permission decision. This one matches the documented intent exactly and doesn't need to change. |

**The sharper problem underneath AâD isn't just staleness â it's that none of them check `accessMode` at all.** `getCurrentUser()` explicitly redirects a `SUSPENDED` or `ARCHIVED` membership to an invalidation handler; `peekSession()` has no equivalent, because checking `accessMode` requires the database query `peekSession()` was specifically built to skip. A person whose access was revoked today keeps a working session cookie for up to 7 days, and for these four endpoints specifically, that cookie still works â they can keep searching (with whatever role their stale JWT claims) and keep reading/managing their notifications after being removed from the company.

---

## 1. The fix

### 1.1 Swap the session helper, following the pattern already correct elsewhere

```ts
// src/app/api/search/route.ts â before
import { peekSession } from "@/lib/dal";
export async function GET(request: NextRequest) {
  const session = await peekSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(session.tenantId, session.userId, session.role, query);
  return NextResponse.json({ results });
}

// after â mirrors the exact pattern already working in
// api/documents/[id]/file/route.ts and api/units/export/route.ts
import { getCurrentUser } from "@/lib/dal";
export async function GET(request: NextRequest) {
  const { tenantId, role, user } = await getCurrentUser();
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(tenantId, user.id, role as Role, query);
  return NextResponse.json({ results });
}
```

Same shape for all three notification routes â replace `peekSession()` with `getCurrentUser()`, drop the now-redundant manual `!session` check (an invalid/expired session is handled by `getCurrentUser()`'s own redirect), and use the live `tenantId`/`user.id` it returns.

### 1.2 One thing to verify before shipping, not assume

`verifySession()` (which `getCurrentUser()` calls) uses `redirect("/")` from `next/navigation` on an invalid session. `redirect()` is designed for Server Components and Server Actions; whether it behaves correctly inside a plain Route Handler's `GET`/`POST` function (versus throwing an error `NextResponse` doesn't know how to turn into a real HTTP redirect) is exactly the kind of framework-boundary detail worth testing explicitly rather than trusting because `documents/[id]/file/route.ts` already does it and presumably works. Write a quick test hitting `/api/search` with no session cookie and confirm the actual HTTP response (redirect vs. 401 vs. an unhandled 500) before treating this fix as done. If it turns out `redirect()` doesn't produce a clean response in a Route Handler, wrap the call:

```ts
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```
Don't add this wrapper pre-emptively without confirming it's needed â if the existing pattern in the documents/units routes already produces a correct response, copy it exactly rather than adding defensive code those working examples don't have.

### 1.3 Acceptance criteria
- [ ] All four routes in the table use `getCurrentUser()`; `layout.tsx`'s benign use of `peekSession()` is left unchanged.
- [ ] A request from a `SUSPENDED`/`ARCHIVED` member's still-valid cookie is rejected by all four routes (test this specifically â it's the concrete new protection this phase adds, not just a refactor).
- [ ] A request made shortly after a role change reflects the *new* role in search scoping, not the JWT's original one â verified by a test that changes a `CompanyMembership.role` mid-test and re-hits the endpoint with the same cookie.
- [ ] The actual HTTP behavior of `getCurrentUser()`'s redirect inside a Route Handler is confirmed (Â§1.2), not assumed.

---

## 2. Sequencing

Four small, mechanical, near-identical changes to independent files â no need to sequence them relative to each other. Do them together in one PR; the only thing worth doing *first* is the Â§1.2 verification, since its answer (does `redirect()` need a wrapper) determines whether all four changes are a one-line import swap or need the extra `try/catch`.

## 3. Definition of Done for Phase 9

- [ ] No API route serves or scopes data using `peekSession()` â every data-serving endpoint re-verifies against the database on every request, matching the discipline `dal.ts` already documents and mostly follows.
- [ ] Suspended/archived members lose access to these four endpoints immediately, not after cookie expiry.
- [ ] Role changes take effect on these endpoints immediately, closing the same 7-day staleness window `getCurrentUser()` already closes everywhere else it's used.
- [ ] Zero new business features shipped during this phase.

## 4. What comes next (not in scope here)

A quick project-wide grep for `peekSession` before merging any future API route, or a lint rule / code-review checklist line ("route handlers serving tenant data must use `getCurrentUser()`, not `peekSession()`") â cheaper than finding a fifth instance of this same substitution mistake later. And, since this phase closes the loop Phase 8 opened ("verify the wiring is exactly right for every role, not just assumed"), this is a reasonable point to treat the access-control audit thread (Phases 1, 6, 7, 8, 9) as complete for now â future phases can shift focus to a different area unless a new concrete finding surfaces.
