import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";

// PRD_Documents_Module — watermark rendering, deferred item. Generated
// on-demand (not stored as a new revision/derivative) using `sharp`, the one
// image-processing library actually present in this stack. Scoped to raster
// images only — no PDF watermarking (no PDF-rendering library here); a PDF
// revision falls back to serving the original bytes unmarked via the
// existing /api/documents/[id]/file route.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "DOCUMENTS", "READ")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const file = await db.documentFile.findUnique({ where: { id } });
  if (!file || file.tenantId !== tenantId || !file.fileData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!file.fileMimeType?.startsWith("image/")) {
    return NextResponse.json({ error: "Watermarking only supports image revisions." }, { status: 400 });
  }

  const label = new URL(request.url).searchParams.get("label") ?? `${user.displayName} — preview only`;
  const image = sharp(Buffer.from(file.fileData));
  const meta = await image.metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 600;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>text { font-family: sans-serif; font-size: ${Math.max(14, Math.round(width / 22))}px; fill: rgba(255,255,255,0.55); }</style>
    <text x="50%" y="50%" text-anchor="middle" transform="rotate(-30 ${width / 2} ${height / 2})">${escapeXml(label)}</text>
  </svg>`;

  const watermarked = await image.composite([{ input: Buffer.from(svg), gravity: "center" }]).png().toBuffer();

  return new NextResponse(new Uint8Array(watermarked), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}
