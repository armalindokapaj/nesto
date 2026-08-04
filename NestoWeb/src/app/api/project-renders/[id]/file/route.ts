import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const render = await db.projectRender.findUnique({ where: { id } });
  if (!render || render.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(render.fileData), {
    headers: {
      "Content-Type": render.fileMimeType,
      "Content-Length": String(render.fileSize),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
