import { prisma } from '../auth.js';

const FEED_LIMIT = 50;

export async function createReminderNotification(input: {
  userId: string;
  projectId: number;
  title: string;
  body: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      type: 'REMINDER',
      title: input.title,
      body: input.body,
    },
  });
}

export async function listNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMIT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(userId: string, id: number) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id },
    data: { readAt: notification.readAt ?? new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}
