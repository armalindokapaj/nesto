import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { peekSession } from "@/lib/dal";
import { globalSearch } from "@/server/search";

export async function GET(request: NextRequest) {
  const session = await peekSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(session.tenantId, session.role, query);
  return NextResponse.json({ results });
}
