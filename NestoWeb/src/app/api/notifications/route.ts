import { NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/dal";
import { listNotifications, unreadNotificationCount } from "@/server/notifications";

export async function GET() {
  const session = await getCurrentApiUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [notifications, unread] = await Promise.all([
    listNotifications(session.tenantId, session.user.id),
    unreadNotificationCount(session.tenantId, session.user.id),
  ]);
  return NextResponse.json({ notifications, unread });
}
