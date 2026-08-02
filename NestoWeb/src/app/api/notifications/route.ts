import { NextResponse } from "next/server";
import { peekSession } from "@/lib/dal";
import { listNotifications, unreadNotificationCount } from "@/server/notifications";

export async function GET() {
  const session = await peekSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [notifications, unread] = await Promise.all([
    listNotifications(session.tenantId, session.userId),
    unreadNotificationCount(session.tenantId, session.userId),
  ]);
  return NextResponse.json({ notifications, unread });
}
