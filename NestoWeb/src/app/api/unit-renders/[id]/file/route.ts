import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readFileFromStorage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const render = await db.unitRender.findUnique({ where: { id } });
  if (!render || render.tenantId !== tenantId || !render.fileUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The bytes live in storage, not the row. This route still streams them
  // rather than redirecting, because that is what keeps the permission check
  // above meaningful — a bare storage URL would bypass it.
  return new NextResponse(await readFileFromStorage(render.fileUrl), {
    headers: {
      "Content-Type": render.fileMimeType,
      "Content-Length": String(render.fileSize),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
