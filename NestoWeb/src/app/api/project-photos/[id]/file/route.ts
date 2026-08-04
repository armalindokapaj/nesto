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
  const photo = await db.projectPhoto.findUnique({ where: { id } });
  if (!photo || photo.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.fileData), {
    headers: {
      "Content-Type": photo.fileMimeType,
      "Content-Length": String(photo.fileSize),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
