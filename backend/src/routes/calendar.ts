import { Router } from 'express';
import type { Request } from 'express';
import { auth, prisma } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateEntryContent } from '../lib/validateEntry.js';

const router = Router();

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const FRONTEND_URL = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const SETTINGS_URL = `${FRONTEND_URL}/settings`;

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  description?: string;
  backgroundColor?: string;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListEntry[];
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  calendarSummary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  calendarId?: string;
  color?: string | null;
};

function hasCalendarScope(account: { scope?: string | null } | null): boolean {
  return Boolean(account?.scope?.includes(GOOGLE_CALENDAR_SCOPE));
}

// Google refresh tokens stop working once they expire. For an OAuth app still
// in Google's "Testing" publishing status that is about seven days after the
// token was issued, so it is the expected end state rather than a fault. The
// stored expiry lets the DB-only status check report it without calling Google
// (see issue #342).
function isRefreshTokenExpired(account: { refreshTokenExpiresAt?: Date | null } | null): boolean {
  return Boolean(
    account?.refreshTokenExpiresAt && account.refreshTokenExpiresAt.getTime() <= Date.now(),
  );
}

/** A linked Google account whose stored credentials can no longer be used. */
function needsCalendarReauth(
  account: { scope?: string | null; refreshTokenExpiresAt?: Date | null } | null,
): boolean {
  return hasCalendarScope(account) && isRefreshTokenExpired(account);
}

type CalendarAuth =
  { state: 'disconnected' } | { state: 'reauth' } | { state: 'ok'; accessToken: string };

// The one place that decides whether calendar data can be fetched: no usable
// Google link, a link that needs reconnecting, or a working access token. Every
// data endpoint resolves auth through here so the failure mapping lives once.
async function resolveCalendarAuth(req: Request): Promise<CalendarAuth> {
  const account = await prisma.account.findFirst({
    where: {
      userId: req.userId,
      providerId: 'google',
    },
  });

  if (!account || !hasCalendarScope(account)) {
    return { state: 'disconnected' };
  }

  try {
    const tokenResult = await auth.api.getAccessToken({
      body: {
        accountId: account.id,
      },
      headers: req.headers,
    });

    return { state: 'ok', accessToken: tokenResult.accessToken };
  } catch {
    // The refresh token is expired or revoked. Report it as needing a
    // reconnect instead of letting it fall through to a generic 500.
    return { state: 'reauth' };
  }
}

async function fetchGoogleCalendars(accessToken: string) {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');

  const googleResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!googleResponse.ok) {
    throw new Error('Failed to fetch Google Calendar list');
  }

  const data = (await googleResponse.json()) as GoogleCalendarListResponse;

  return data.items ?? [];
}

type EventRange = { timeMin: Date; timeMax: Date };

// The calendar grid asks for one month or week at a time; a few days either
// side of a month is still well under this.
const MAX_RANGE_DAYS = 62;

/**
 * Reads optional `from`/`to` (ISO date-times) from the query. Both absent
 * means the default upcoming window; anything else malformed is an error
 * string for a 400.
 */
function parseEventRange(query: Request['query']): EventRange | null | string {
  const { from, to } = query;
  if (from === undefined && to === undefined) return null;
  if (typeof from !== 'string' || typeof to !== 'string') {
    return 'from and to must be given together';
  }

  const timeMin = new Date(from);
  const timeMax = new Date(to);
  if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
    return 'from and to must be ISO dates';
  }
  if (timeMax <= timeMin) return 'to must be after from';
  if (timeMax.getTime() - timeMin.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return `The range can be at most ${MAX_RANGE_DAYS} days`;
  }

  return { timeMin, timeMax };
}

async function fetchCalendarEvents(
  req: Request,
  accessToken: string,
  range: EventRange | null = null,
) {
  const sources = await prisma.calendarSource.findMany({
    where: {
      userId: req.userId,
      enabled: true,
    },
    orderBy: {
      order: 'asc',
    },
  });

  // Without a range this is the upcoming list: the next 30 days, a few
  // events per calendar. A range is a grid page, which needs all of them.
  const timeMin = range?.timeMin ?? new Date();
  const timeMax = range?.timeMax ?? new Date();
  if (!range) timeMax.setDate(timeMax.getDate() + 30);
  const maxResults = range ? '250' : '20';

  const allEvents: GoogleCalendarEvent[] = [];

  for (const source of sources) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events`,
    );

    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', maxResults);

    const googleResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!googleResponse.ok) {
      throw new Error('Failed to fetch Google Calendar events');
    }

    const data = (await googleResponse.json()) as {
      items?: GoogleCalendarEvent[];
    };

    const events = data.items ?? [];

    for (const event of events) {
      allEvents.push({
        ...event,
        calendarId: source.calendarId,
        calendarSummary: source.summary,
        color: source.color,
      });
    }
  }

  return allEvents;
}

// A DB-only check so Settings can show connection status without calling
// Google or touching the link/unlink flow (see issue #160).
router.get('/status', authenticate, async (req, res) => {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: req.userId,
        providerId: 'google',
      },
    });

    return res.status(200).json({
      connected: hasCalendarScope(account),
      needsReauth: needsCalendarReauth(account),
    });
  } catch (error) {
    console.error('Google Calendar status error:', error);

    return res.status(500).json({
      error: 'Failed to fetch Google Calendar status',
    });
  }
});

router.get('/sources', authenticate, async (req, res) => {
  try {
    const authState = await resolveCalendarAuth(req);

    if (authState.state === 'disconnected') {
      return res.status(200).json({
        connected: false,
        sources: [],
      });
    }

    if (authState.state === 'reauth') {
      return res.status(200).json({
        connected: true,
        needsReauth: true,
        sources: [],
      });
    }

    const calendars = await fetchGoogleCalendars(authState.accessToken);

    for (const [index, calendar] of calendars.entries()) {
      await prisma.calendarSource.upsert({
        where: {
          userId_calendarId: {
            userId: req.userId,
            calendarId: calendar.id,
          },
        },
        update: {
          summary: calendar.summary ?? 'Untitled calendar',
          description: calendar.description ?? 'No description provided',
        },
        create: {
          userId: req.userId,
          calendarId: calendar.id,
          summary: calendar.summary ?? 'Untitled calendar',
          description: calendar.description ?? 'No description provided',
          color: calendar.backgroundColor ?? '#808080',
          enabled: true,
          order: index,
        },
      });
    }

    const sources = await prisma.calendarSource.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        order: 'asc',
      },
    });

    return res.status(200).json({
      connected: true,
      sources,
    });
  } catch (error) {
    console.error('Google Calendar sources error:', error);

    return res.status(500).json({
      error: 'Failed to fetch Google Calendar sources',
    });
  }
});

router.patch('/sources/:id', authenticate, async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id as string, 10);

    if (Number.isNaN(sourceId)) {
      return res.status(400).json({
        error: 'Invalid calendar source id',
      });
    }

    const { enabled, color, order } = req.body;

    const source = await prisma.calendarSource.findFirst({
      where: {
        id: sourceId,
        userId: req.userId,
      },
    });

    if (!source) {
      return res.status(404).json({
        error: 'Calendar source not found',
      });
    }
    if (color !== undefined && (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color))) {
      return res.status(400).json({
        error: 'Invalid calendar source color',
      });
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid calendar source enabled value',
      });
    }

    if (order !== undefined) {
      const sourceCount = await prisma.calendarSource.count({
        where: {
          userId: req.userId,
        },
      });

      if (!Number.isInteger(order) || order < 0 || order >= sourceCount) {
        return res.status(400).json({
          error: 'Invalid calendar source order',
        });
      }
    }
    const updatedSource = await prisma.$transaction(async (tx) => {
      if (order !== undefined && order > source.order) {
        const sourcesToShift = await tx.calendarSource.findMany({
          where: {
            userId: req.userId,
            order: {
              gt: source.order,
              lte: order,
            },
          },
        });

        for (const sourceToShift of sourcesToShift) {
          await tx.calendarSource.update({
            where: {
              id: sourceToShift.id,
            },
            data: {
              order: sourceToShift.order - 1,
            },
          });
        }
      }

      if (order !== undefined && order < source.order) {
        const sourcesToShift = await tx.calendarSource.findMany({
          where: {
            userId: req.userId,
            order: {
              gte: order,
              lt: source.order,
            },
          },
        });

        for (const sourceToShift of sourcesToShift) {
          await tx.calendarSource.update({
            where: {
              id: sourceToShift.id,
            },
            data: {
              order: sourceToShift.order + 1,
            },
          });
        }
      }

      return tx.calendarSource.update({
        where: {
          id: sourceId,
        },
        data: {
          ...(enabled !== undefined && { enabled }),
          ...(color !== undefined && { color }),
          ...(order !== undefined && { order }),
        },
      });
    });
    return res.status(200).json(updatedSource);
  } catch (error) {
    console.error('Google Calendar source update error:', error);

    return res.status(500).json({
      error: 'Failed to update calendar sources',
    });
  }
});

router.post('/connect', authenticate, async (req, res) => {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: req.userId,
        providerId: 'google',
      },
    });

    // A plain Google sign-in links a 'google' account without the Calendar
    // scope; only treat it as already connected once that scope is present and
    // the stored credentials still work. When the refresh token has expired we
    // fall through and run the consent flow again, which mints a fresh one — so
    // "Reconnect" needs no separate endpoint (see issue #342).
    if (hasCalendarScope(account) && !isRefreshTokenExpired(account)) {
      return res.status(200).json({
        connected: true,
        message: 'Google Calendar is already connected',
      });
    }
    const result = await auth.api.linkSocialAccount({
      body: {
        provider: 'google',
        scopes: [GOOGLE_CALENDAR_SCOPE],
        disableRedirect: true,
        callbackURL: SETTINGS_URL,
        errorCallbackURL: SETTINGS_URL,
      },
      headers: req.headers,
      asResponse: true,
    });

    const setCookies = result.headers.getSetCookie();
    if (setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies);
    }

    const data = await result.json();

    return res.status(result.status).json(data);
  } catch (error) {
    console.error('Google Calendar connect error:', error);

    return res.status(400).json({
      error: 'Failed to connect Google Calendar',
    });
  }
});

router.delete('/disconnect', authenticate, async (req, res) => {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: req.userId,
        providerId: 'google',
      },
    });

    if (!account) {
      return res.status(200).json({
        connected: false,
        message: 'Google Calendar is not connected',
      });
    }

    await auth.api.unlinkAccount({
      body: {
        accountId: account.id,
      },
      headers: req.headers,
    });

    return res.status(200).json({
      connected: false,
      message: 'Google Calendar disconnected successfully',
    });
  } catch (error) {
    console.error('Google Calendar disconnect error:', error);

    return res.status(400).json({
      error: 'Failed to disconnect Google Calendar',
    });
  }
});

router.get('/events', authenticate, async (req, res) => {
  try {
    const range = parseEventRange(req.query);
    if (typeof range === 'string') {
      return res.status(400).json({ error: range });
    }

    const authState = await resolveCalendarAuth(req);

    if (authState.state === 'disconnected') {
      return res.status(200).json({
        connected: false,
        message: 'Google Calendar is not connected',
      });
    }

    if (authState.state === 'reauth') {
      return res.status(200).json({
        connected: true,
        needsReauth: true,
        events: [],
      });
    }

    const events = await fetchCalendarEvents(req, authState.accessToken, range);

    return res.status(200).json({
      connected: true,
      events,
    });
  } catch (error) {
    console.error('Google Calendar events error:', error);

    return res.status(500).json({
      error: 'Failed to fetch the Google Calendar events',
    });
  }
});

router.get('/events/suggestions', authenticate, async (req, res) => {
  try {
    const authState = await resolveCalendarAuth(req);

    if (authState.state === 'disconnected') {
      return res.status(200).json({
        connected: false,
        suggestions: [],
      });
    }

    if (authState.state === 'reauth') {
      return res.status(200).json({
        connected: true,
        needsReauth: true,
        suggestions: [],
      });
    }

    const events = await fetchCalendarEvents(req, authState.accessToken);

    const handledSuggestions = await prisma.calendarSuggestion.findMany({
      where: {
        userId: req.userId,
      },
      select: {
        calendarId: true,
        eventId: true,
      },
    });

    const handledEvents = new Set(
      handledSuggestions.map((suggestion) => `${suggestion.calendarId}:${suggestion.eventId}`),
    );

    const suggestions = events
      .filter(
        (event) =>
          event.id && event.calendarId && !handledEvents.has(`${event.calendarId}:${event.id}`),
      )
      .map((event) => ({
        id: event.id,
        calendarId: event.calendarId,
        title: event.summary ?? 'Untitled event',
        start: event.start?.dateTime ?? event.start?.date,
        end: event.end?.dateTime ?? event.end?.date,
      }));

    return res.status(200).json({
      connected: true,
      suggestions,
    });
  } catch (error) {
    console.error('Google Calendar suggestions error:', error);

    return res.status(500).json({
      error: 'Failed to fetch calendar suggestions',
    });
  }
});

router.post('/events/suggestions/:eventId/accept', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const eventId = req.params.eventId as string;

    if (!eventId) {
      return res.status(400).json({
        error: 'eventId is required',
      });
    }

    const { projectId, content, date, calendarId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || !content || !calendarId) {
      return res.status(400).json({
        error: 'projectId, calendarId and content are required',
      });
    }

    const projectIdInt = parseInt(projectId, 10);

    if (Number.isNaN(projectIdInt)) {
      return res.status(400).json({
        error: 'projectId must be a valid integer',
      });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectIdInt,
        userId,
      },
      include: {
        fields: true,
      },
    });

    if (!project) {
      return res.status(403).json({
        error: 'You do not have access to this project',
      });
    }

    const contentErrors = validateEntryContent(content, project.fields);

    if (contentErrors.length > 0) {
      return res.status(400).json({
        errors: contentErrors,
      });
    }

    const entry = await prisma.entry.create({
      data: {
        projectId: projectIdInt,
        content,
        date: date ? new Date(date) : new Date(),
      },
    });

    await prisma.calendarSuggestion.create({
      data: {
        userId,
        calendarId,
        eventId,
        status: 'ACCEPTED',
      },
    });

    return res.status(201).json(entry);
  } catch (error) {
    console.error('Google Calendar suggestion accept error:', error);

    return res.status(500).json({
      error: 'Failed to accept calendar suggestion',
    });
  }
});

router.post('/events/suggestions/:eventId/reject', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const eventId = req.params.eventId as string;
    const { calendarId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        error: 'eventId is required',
      });
    }

    if (!calendarId) {
      return res.status(400).json({
        error: 'calendarId is required',
      });
    }

    await prisma.calendarSuggestion.create({
      data: {
        userId,
        calendarId,
        eventId,
        status: 'REJECTED',
      },
    });

    return res.status(200).json({
      message: 'Calendar suggestion rejected',
    });
  } catch (error) {
    console.error('Google Calendar suggestion reject error', error);

    return res.status(500).json({
      error: 'Failed to reject calendar suggestion',
    });
  }
});

export default router;
