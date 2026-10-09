import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthenticatedUser,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

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

async function connectAccount(email: string) {
  return linkGoogleAccount(
    await getUserId(email),
    'https://www.googleapis.com/auth/calendar.readonly openid',
  );
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
  it('starts the OAuth flow, forwards the consent URL, and preserves Set-Cookie', async () => {
    const { agent } = await createAuthenticatedUser();
    // asResponse: true (see calendar.ts) makes linkSocialAccount resolve a
    // raw Response-like object rather than a parsed body, so the route can
    // read and forward its Set-Cookie headers untouched.
    linkSocialAccount.mockResolvedValue({
      status: 200,
      headers: { getSetCookie: () => ['oauth_state=abc123; HttpOnly; Path=/'] },
      json: async () => ({ url: 'https://accounts.google.com/o/oauth2/consent' }),
    });

    const response = await agent.post('/api/calendar/connect');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: 'https://accounts.google.com/o/oauth2/consent' });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('oauth_state=abc123')]),
    );
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

describe('GET /api/calendar/sources', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();

    const response = await api.get('/api/calendar/sources');

    expect(response.status).toBe(401);
  });

  it('reports disconnected when there is no linked Google account', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/calendar/sources');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: false,
      sources: [],
    });
  });

  it('fetches calendars from Google and saves them as sources', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);

    getAccessToken.mockResolvedValue({
      accessToken: 'test-access-token',
    });

    const calendars = [
      {
        id: 'calendar-1',
        summary: 'Lectures',
        description: 'University lectures',
        backgroundColor: '#4285F4',
      },
      {
        id: 'calendar-2',
        summary: 'Tutorials',
        backgroundColor: '#A47AE2',
      },
    ];

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: calendars }), { status: 200 }),
    );

    const response = await agent.get('/api/calendar/sources');

    expect(response.status).toBe(200);
    expect(response.body.connected).toBe(true);
    expect(response.body.sources).toHaveLength(2);

    expect(response.body.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          calendarId: 'calendar-1',
          summary: 'Lectures',
          description: 'University lectures',
          color: '#4285F4',
          enabled: true,
          order: 0,
        }),
        expect.objectContaining({
          calendarId: 'calendar-2',
          summary: 'Tutorials',
          description: 'No description provided',
          color: '#A47AE2',
          enabled: true,
          order: 1,
        }),
      ]),
    );

    const [url, init] = vi.mocked(fetch).mock.calls[0];

    expect(String(url)).toContain('https://www.googleapis.com/calendar/v3/users/me/calendarList');

    expect(init?.headers).toEqual({
      Authorization: 'Bearer test-access-token',
    });
  });

  it('returns 500 when Google Calendar list fetch fails', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);

    getAccessToken.mockResolvedValue({
      accessToken: 'test-access-token',
    });

    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));

    const response = await agent.get('/api/calendar/sources');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Failed to fetch Google Calendar sources',
    });
  });
});

describe('PATCH /api/calendar/sources/:id', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();

    const response = await api.patch('/api/calendar/sources/1').send({
      enabled: false,
    });

    expect(response.status).toBe(401);
  });

  it('rejects an invalid source id', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.patch('/api/calendar/sources/not-a-number').send({
      enabled: false,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid calendar source id',
    });
  });

  it('returns 404 when the source does not belong to the user', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.patch('/api/calendar/sources/999999').send({
      enabled: false,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Calendar source not found',
    });
  });

  it('updates enabled, color, and order', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await getUserId(email);

    const first = await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Lectures',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });

    const second = await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-2',
        summary: 'Tutorials',
        color: '#A47AE2',
        enabled: true,
        order: 1,
      },
    });

    const response = await agent.patch(`/api/calendar/sources/${second.id}`).send({
      enabled: false,
      color: '#FF0000',
      order: 0,
    });

    expect(response.status).toBe(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: second.id,
        enabled: false,
        color: '#FF0000',
        order: 0,
      }),
    );

    const updatedFirst = await prisma.calendarSource.findUniqueOrThrow({
      where: { id: first.id },
    });

    expect(updatedFirst.order).toBe(1);
  });

  it('rejects an invalid color', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await getUserId(email);

    const source = await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Lectures',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });

    const response = await agent.patch(`/api/calendar/sources/${source.id}`).send({
      color: 'red',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid calendar source color',
    });
  });

  it('rejects an invalid enabled value', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await getUserId(email);

    const source = await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Lectures',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });

    const response = await agent.patch(`/api/calendar/sources/${source.id}`).send({
      enabled: 'false',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid calendar source enabled value',
    });
  });

  it('rejects an invalid order', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const userId = await getUserId(email);

    const source = await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Lectures',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });

    const response = await agent.patch(`/api/calendar/sources/${source.id}`).send({
      order: 5,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid calendar source order',
    });
  });
});

describe('GET /api/calendar/events', () => {
  it('returns events fetched from the Google Calendar API', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    const userId = await getUserId(email);
    await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Tutorials',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });

    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    const events = [{ id: 'evt-1', summary: 'Lecture' }];
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: events }), { status: 200 }),
    );

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: true,
      events: [
        {
          id: 'evt-1',
          summary: 'Lecture',
          calendarId: 'calendar-1',
          calendarSummary: 'Tutorials',
          color: '#4285F4',
        },
      ],
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('calendars/calendar-1/events');
    expect(init?.headers).toEqual({ Authorization: 'Bearer test-access-token' });
  });

  it('returns 500 when the Google Calendar API responds with an error', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    const userId = await getUserId(email);
    await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Tutorials',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));

    const response = await agent.get('/api/calendar/events');

    // getCalendarEvents() throws a plain Error on a non-ok Google response
    // rather than distinguishing it from any other failure (see calendar.ts)
    // — the route's catch-all always returns 500 with this exact message.
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to fetch the Google Calendar events' });
  });

  it('returns 500 when the access token cannot be retrieved', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);

    getAccessToken.mockRejectedValue(new Error('token expired'));

    const response = await agent.get('/api/calendar/events');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to fetch the Google Calendar events' });
  });

  it('asks Google for the next 30 days, 20 per calendar, when no range is given', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    const userId = await getUserId(email);
    await prisma.calendarSource.create({
      data: { userId, calendarId: 'calendar-1', summary: 'Tutorials', enabled: true, order: 0 },
    });
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] })));

    const before = Date.now();
    await agent.get('/api/calendar/events');

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    const timeMin = new Date(url.searchParams.get('timeMin')!).getTime();
    const timeMax = new Date(url.searchParams.get('timeMax')!).getTime();
    expect(timeMin).toBeGreaterThanOrEqual(before - 1000);
    expect(Math.round((timeMax - timeMin) / (24 * 60 * 60 * 1000))).toBe(30);
    expect(url.searchParams.get('maxResults')).toBe('20');
  });

  it('asks Google for exactly the requested window when from and to are given', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    const userId = await getUserId(email);
    await prisma.calendarSource.create({
      data: { userId, calendarId: 'calendar-1', summary: 'Tutorials', enabled: true, order: 0 },
    });
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ items: [] })));

    const response = await agent
      .get('/api/calendar/events')
      .query({ from: '2026-08-31T22:00:00.000Z', to: '2026-09-30T22:00:00.000Z' });

    expect(response.status).toBe(200);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get('timeMin')).toBe('2026-08-31T22:00:00.000Z');
    expect(url.searchParams.get('timeMax')).toBe('2026-09-30T22:00:00.000Z');
    expect(url.searchParams.get('maxResults')).toBe('250');
  });

  it.each([
    [{ from: '2026-09-01T00:00:00.000Z' }, 'from and to must be given together'],
    [{ from: 'soon', to: '2026-09-30T00:00:00.000Z' }, 'from and to must be ISO dates'],
    [{ from: '2026-09-30T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z' }, 'to must be after from'],
    [
      { from: '2026-01-01T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' },
      'The range can be at most 62 days',
    ],
  ])('rejects the range %o', async (query, error) => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/calendar/events').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/calendar/events/suggestions', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.get('/api/calendar/events/suggestions');
    expect(response.status).toBe(401);
  });

  it('reports disconnected with no suggestions when there is no linked Google account', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/calendar/events/suggestions');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ connected: false, suggestions: [] });
  });

  it('excludes events that already have an accepted or rejected suggestion', async () => {
    const { agent, email } = await createAuthenticatedUser();
    await connectAccount(email);
    const userId = await getUserId(email);
    await prisma.calendarSource.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        summary: 'Tutorials',
        color: '#4285F4',
        enabled: true,
        order: 0,
      },
    });
    getAccessToken.mockResolvedValue({ accessToken: 'test-access-token' });
    const events = [
      { id: 'evt-handled', summary: 'Already handled', start: { date: '2026-09-10' } },
      {
        id: 'evt-new',
        summary: 'New lecture',
        start: { dateTime: '2026-09-11T10:00:00Z' },
        end: { dateTime: '2026-09-11T11:00:00Z' },
      },
    ];
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ items: events }), { status: 200 }),
    );
    await prisma.calendarSuggestion.create({
      data: {
        userId,
        calendarId: 'calendar-1',
        eventId: 'evt-handled',
        status: 'REJECTED',
      },
    });

    const response = await agent.get('/api/calendar/events/suggestions');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: true,
      suggestions: [
        {
          id: 'evt-new',
          calendarId: 'calendar-1',
          title: 'New lecture',
          start: '2026-09-11T10:00:00Z',
          end: '2026-09-11T11:00:00Z',
        },
      ],
    });
  });
});
