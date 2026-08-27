import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readFileFromStorage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const doc = await db.documentFile.findUnique({ where: { id } });
  if (!doc || doc.tenantId !== tenantId || !doc.fileUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Documents are private (STORAGE_VISIBILITY): the bytes are fetched from
  // storage and streamed through this route so the DOCUMENTS:READ check and
  // the tenant check above still govern every read.
  const bytes = await readFileFromStorage(doc.fileUrl);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": doc.fileMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.name.replace(/["\r\n]/g, "")}"`,
      "Content-Length": String(doc.fileSize ?? bytes.byteLength),
    },
  });
}
