import { NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/dal";
import { getNotification } from "@/server/notifications";

/** Read by id — the destination-page spotlight resolves `?highlight=<id>`. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentApiUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const notification = await getNotification(session.tenantId, session.user.id, id);
  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ notification });
}
