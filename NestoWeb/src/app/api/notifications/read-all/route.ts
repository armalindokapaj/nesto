import { NextResponse } from "next/server";
import { peekSession } from "@/lib/dal";
import { markAllNotificationsRead } from "@/server/notifications";

export async function POST() {
  const session = await peekSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markAllNotificationsRead(session.tenantId, session.userId);
  return NextResponse.json({ ok: true });
}
