import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createAuthenticatedUser, deleteTestUsers, disconnectTestDatabase } from './helpers/api.js';

// Everything in calendar.ts that actually talks to Google (linking, unlinking,
// fetching events) is mocked here rather than hitting Google for real — CI has
// no Google credentials, and the response is out of our control anyway. The
// DB-only branches (already connected / not connected) are covered without
// mocking in calendar.api.test.ts.
const { linkSocialAccount, unlinkAccount, getAccessToken } = vi.hoisted(() => ({
  linkSocialAccount: vi.fn(),
  unlinkAccount: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock('../src/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/auth.js')>();
  return {
    ...actual,
    auth: {
      ...actual.auth,
      api: {
        ...actual.auth.api,
        linkSocialAccount,
        unlinkAccount,
        getAccessToken,
      },
    },
  };
});

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function getUserId(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

async function linkGoogleAccount(userId: string, scope: string) {
  return prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: randomUUID(),
      providerId: 'google',
      userId,
      scope,
    },
  });
}

beforeEach(() => {
  linkSocialAccount.mockReset();
  unlinkAccount.mockReset();
  getAccessToken.mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await deleteTestUsers();
});

afterAll(async () => {
  await prisma.$disconnect();
  await disconnectTestDatabase();
});

describe('POST /api/calendar/connect', () => {
  it('starts the OAuth flow and returns the consent URL', async () => {
    const { agent } = await createAuthenticatedUser();
    linkSocialAccount.mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/consent' });

    const response = await agent.post('/api/calendar/connect');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: 'https://accounts.google.com/o/oauth2/consent' });
    expect(linkSocialAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          provider: 'google',
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        }),
      }),
    );
  });

  it('returns 400 when Better Auth fails to start the flow', async () => {
    const { agent } = await createAuthenticatedUser();
    linkSocialAccount.mockRejectedValue(new Error('provider unavailable'));

    const response = await agent.post('/api/calendar/connect');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Failed to connect Google Calendar' });
  });
});

describe('DELETE /api/calendar/disconnect', () => {
  it('unlinks the account and reports disconnected', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const account = await linkGoogleAccount(
      await getUserId(email),
      'https://www.googleapis.com/auth/calendar.readonly openid',
    );
    unlinkAccount.mockResolvedValue(undefined);

    const response = await agent.delete('/api/calendar/disconnect');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: false,
      message: 'Google Calendar disconnected successfully',
    });
    expect(unlinkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ body: { accountId: account.id } }),
    );
  });

  it('returns 400 when Better Auth fails to unlink the account', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await linkGoogleAccount(
      await getUserId(email),
      'https://www.googleapis.com/auth/calendar.readonly openid',
    );
    unlinkAccount.mockRejectedValue(new Error('provider unavailable'));

    const response = await agent.delete('/api/calendar/disconnect');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Failed to disconnect Google Calendar' });
  });
});

describe('GET /api/calendar/events', () => {
  async function connectAccount(email: string) {
    return linkGoogleAccount(
      await getUserId(email),
      'https://www.googleapis.com/auth/calendar.readonly openid',
    );
  }

  it('returns events fetched from the Google Calendar API', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    const events = [{ id: 'evt-1', summary: 'Lecture' }];
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: events }), { status: 200 }),
    );

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: true, events });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('calendars/primary/events');
    expect(init?.headers).toEqual({ Authorization: 'Bearer test-access-token' });
  });

  it('returns 502 when the Google Calendar API responds with an error', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Failed to fetch Google Calendar events' });
  });

  it('returns 500 when the access token cannot be retrieved', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    getAccessToken.mockRejectedValue(new Error('token expired'));

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to fetch Google Calendar events' });
  });
});
