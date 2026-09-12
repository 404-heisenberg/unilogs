import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthenticatedUser,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

afterEach(deleteTestUsers);
afterAll(async () => {
  await prisma.$disconnect();
  await disconnectTestDatabase();
});

async function getUserId(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

async function linkGoogleAccount(userId: string, scope: string) {
  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: randomUUID(),
      providerId: 'google',
      userId,
      scope,
    },
  });
}

describe('GET /api/calendar/status', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.get('/api/calendar/status');
    expect(response.status).toBe(401);
  });

  it('reports disconnected when the user has no Google account', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/calendar/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: false });
  });

  it('reports disconnected when a linked Google account lacks the Calendar scope', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await linkGoogleAccount(await getUserId(email), 'openid email');

    const response = await agent.get('/api/calendar/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: false });
  });

  it('reports connected when a linked Google account has the Calendar scope', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await linkGoogleAccount(
      await getUserId(email),
      'https://www.googleapis.com/auth/calendar.readonly openid',
    );

    const response = await agent.get('/api/calendar/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: true });
  });
});

describe('POST /api/calendar/connect', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.post('/api/calendar/connect');
    expect(response.status).toBe(401);
  });

  it('reports already connected without starting a new OAuth flow', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await linkGoogleAccount(
      await getUserId(email),
      'https://www.googleapis.com/auth/calendar.readonly openid',
    );

    const response = await agent.post('/api/calendar/connect');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: true,
      message: 'Google Calendar is already connected',
    });
  });
});

describe('DELETE /api/calendar/disconnect', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.delete('/api/calendar/disconnect');
    expect(response.status).toBe(401);
  });

  it('reports not connected when there is no linked Google account', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.delete('/api/calendar/disconnect');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: false,
      message: 'Google Calendar is not connected',
    });
  });
});

describe('GET /api/calendar/events', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.get('/api/calendar/events');
    expect(response.status).toBe(401);
  });

  it('reports not connected when there is no linked Google account', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: false,
      message: 'Google Calendar is not connected',
    });
  });
});
