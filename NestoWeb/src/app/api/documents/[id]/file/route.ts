import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const doc = await db.documentFile.findUnique({ where: { id } });
  if (!doc || doc.tenantId !== tenantId || !doc.fileData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.fileData), {
    headers: {
      "Content-Type": doc.fileMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.name.replace(/["\r\n]/g, "")}"`,
      "Content-Length": String(doc.fileSize ?? doc.fileData.length),
    },
  });
}
