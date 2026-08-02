import { db } from "@/lib/db";

export async function listNotifications(tenantId: string, userId: string, limit = 20) {
  return db.notification.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
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
