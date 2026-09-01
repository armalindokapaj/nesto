import { db } from "@/lib/db";

export async function listNotifications(tenantId: string, userId: string, limit = 20) {
  return db.notification.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * A single notification, tenant- and user-scoped the same way the list is —
 * the spotlight banner on a destination page reads one by id from the
 * `?highlight=` param, and must never be able to read someone else's.
 */
export async function getNotification(tenantId: string, userId: string, notificationId: string) {
  return db.notification.findFirst({ where: { id: notificationId, tenantId, userId } });
}

export async function unreadNotificationCount(tenantId: string, userId: string) {
  return db.notification.count({ where: { tenantId, userId, isRead: false } });
}

export async function markNotificationRead(tenantId: string, userId: string, notificationId: string) {
  return db.notification.updateMany({
    where: { id: notificationId, tenantId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(tenantId: string, userId: string) {
  return db.notification.updateMany({
    where: { tenantId, userId, isRead: false },
    data: { isRead: true },
  });
}
