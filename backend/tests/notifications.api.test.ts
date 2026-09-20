import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';
import { prisma } from '../src/auth.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

async function seedNotification(userId: string, title: string, createdAt?: Date) {
  return prisma.notification.create({
    data: { userId, type: 'SYSTEM', title, body: `${title} body`, createdAt },
  });
}

async function userIdFor(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('test user missing');
  return user.id;
}

describe('notification feed', () => {
  it('returns newest first with an unread count', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await userIdFor(email);
    await seedNotification(userId, 'Older', new Date('2026-09-01T00:00:00Z'));
    await seedNotification(userId, 'Newer', new Date('2026-09-10T00:00:00Z'));

    const response = await agent.get('/api/notifications');

    expect(response.status).toBe(200);
    expect(response.body.unreadCount).toBe(2);
    expect(response.body.notifications.map((n: { title: string }) => n.title)).toEqual([
      'Newer',
      'Older',
    ]);
  });

  it('is empty for a fresh user', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/notifications');

    expect(response.body).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('marks one notification read', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await userIdFor(email);
    const notification = await seedNotification(
      userId,
      'Read me',
      new Date('2026-09-10T00:00:00Z'),
    );

    const read = await agent.post(`/api/notifications/${notification.id}/read`);
    const feed = await agent.get('/api/notifications');

    expect(read.status).toBe(200);
    expect(read.body.readAt).not.toBeNull();
    expect(feed.body.unreadCount).toBe(0);
  });

  it('marks every notification read', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await userIdFor(email);
    await seedNotification(userId, 'One', new Date('2026-09-01T00:00:00Z'));
    await seedNotification(userId, 'Two', new Date('2026-09-02T00:00:00Z'));

    const response = await agent.post('/api/notifications/read-all');
    const feed = await agent.get('/api/notifications');

    expect(response.status).toBe(200);
    expect(response.body.updated).toBe(2);
    expect(feed.body.unreadCount).toBe(0);
  });

  it('404s a notification owned by another user', async () => {
    const owner = await createAuthenticatedUser();
    const other = await createAuthenticatedUser();
    const ownerId = await userIdFor(owner.email);
    const notification = await seedNotification(ownerId, 'Private');

    const response = await other.agent.post(`/api/notifications/${notification.id}/read`);

    expect(response.status).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();

    const responses = await Promise.all([
      api.get('/api/notifications'),
      api.post('/api/notifications/1/read'),
      api.post('/api/notifications/read-all'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });
});
