import { NextResponse } from "next/server";
import { peekSession } from "@/lib/dal";
import { markNotificationRead } from "@/server/notifications";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await peekSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await markNotificationRead(session.tenantId, session.userId, id);
  return NextResponse.json({ ok: true });
}
