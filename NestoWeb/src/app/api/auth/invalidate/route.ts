import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

// A session cookie can be signature-valid (jose still verifies it) while
// referencing a userId/tenantId that no longer exists in the database — e.g.
// after a dev database reset, or a deleted/suspended account. proxy.ts's
// optimistic check only verifies the signature, so it can't detect this; the
// DAL's DB-backed getCurrentUser() is what actually catches it. But Server
// Components can't mutate cookies during render, so the DAL redirects here
// instead of just calling redirect("/") directly — a Route Handler is
// allowed to clear the stale cookie before redirecting, which is what
// actually breaks the loop (redirecting straight to "/" without clearing it
// would just have proxy see the same "valid" cookie and bounce back).
export async function GET(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL("/", request.url));
}
