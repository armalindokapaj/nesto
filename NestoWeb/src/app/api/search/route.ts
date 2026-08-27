import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/dal";
import { globalSearch } from "@/server/search";

export async function GET(request: NextRequest) {
  const session = await getCurrentApiUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.get("q") ?? "";
  // session.role is read live from CompanyMembership, so a demotion narrows
  // these results on the very next request rather than in up to seven days.
  const results = await globalSearch(session.tenantId, session.user.id, session.role, query);
  return NextResponse.json({ results });
}
