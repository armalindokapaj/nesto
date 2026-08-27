import { NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/dal";
import { markNotificationRead } from "@/server/notifications";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentApiUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  await markNotificationRead(session.tenantId, session.user.id, id);
  return NextResponse.json({ ok: true });
}
