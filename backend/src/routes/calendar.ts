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
  backgroundColor?: string;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListEntry[];
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
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

async function getGoogleCalendars(req: Request) {
  const account = await prisma.account.findFirst({
    where: {
      userId: req.userId,
      providerId: 'google',
    },
  });

  if (!account || !hasCalendarScope(account)) {
    return null;
  }

  const tokenResult = await auth.api.getAccessToken({
    body: {
      accountId: account.id,
    },
    headers: req.headers,
  });

  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');

  const googleResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
    },
  });

  if (!googleResponse.ok) {
    throw new Error('Failed to fetch Google Calendar list');
  }

  const data = (await googleResponse.json()) as GoogleCalendarListResponse;

  return data.items ?? [];
}

async function getCalendarEvents(req: Request) {
  const account = await prisma.account.findFirst({
    where: {
      userId: req.userId,
      providerId: 'google',
    },
  });

  if (!account || !hasCalendarScope(account)) {
    return null;
  }

  const tokenResult = await auth.api.getAccessToken({
    body: {
      accountId: account.id,
    },
    headers: req.headers,
  });

  const sources = await prisma.calendarSource.findMany({
    where: {
      userId: req.userId,
      enabled: true,
    },
    orderBy: {
      order: 'asc',
    },
  });

  const now = new Date();
  const timeMax = new Date();

  timeMax.setDate(timeMax.getDate() + 30);

  const allEvents: GoogleCalendarEvent[] = [];

  for (const source of sources) {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events`,
    );

    url.searchParams.set('timeMin', now.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '20');

    const googleResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
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
    const calendars = await getGoogleCalendars(req);

    if (calendars === null) {
      return res.status(200).json({
        connected: false,
        sources: [],
      });
    }

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
          color: calendar.backgroundColor ?? null,
        },
        create: {
          userId: req.userId,
          calendarId: calendar.id,
          summary: calendar.summary ?? 'Untitled calendar',
          color: calendar.backgroundColor ?? null,
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
    console.error('Googe Calendar source update error:', error);

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
    // scope; only treat it as already connected once that scope is present.
    if (hasCalendarScope(account)) {
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
    const events = await getCalendarEvents(req);

    if (events === null) {
      return res.status(200).json({
        connected: false,
        message: 'Google Calendar is not connected',
      });
    }

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
    const events = await getCalendarEvents(req);

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

    if (events === null) {
      return res.status(200).json({
        connected: false,
        suggestions: [],
      });
    }

    const suggestions = (events as GoogleCalendarEvent[])
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

    const { projectId, content, date } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || !content) {
      return res.status(400).json({
        error: 'projectId and content are required',
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

    if (!eventId) {
      return res.status(400).json({
        error: 'eventId is required',
      });
    }

    await prisma.calendarSuggestion.create({
      data: {
        userId,
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
