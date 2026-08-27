import { NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/dal";
import { markAllNotificationsRead } from "@/server/notifications";

export async function POST() {
  const session = await getCurrentApiUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markAllNotificationsRead(session.tenantId, session.user.id);
  return NextResponse.json({ ok: true });
}
