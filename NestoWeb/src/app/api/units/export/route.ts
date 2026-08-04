import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { canViewUnits } from "@/lib/unit-access";
import { buildUnitsCsv } from "@/server/unit-export";

export async function GET(request: Request) {
  const { tenantId, role } = await getCurrentUser();
  if (!canViewUnits(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const csv = await buildUnitsCsv(tenantId, projectId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="units-${projectId}.csv"`,
    },
  });
}
