import { Router } from 'express';
import type { Request } from 'express';
import { auth, prisma } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const FRONTEND_URL = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const SETTINGS_URL = `${FRONTEND_URL}/settings`;

type GoogleCalendarResponse = {
  items?: unknown[];
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
};

function hasCalendarScope(account: { scope?: string | null } | null): boolean {
  return Boolean(account?.scope?.includes(GOOGLE_CALENDAR_SCOPE));
}

async function getCalendarEvents(req: Request) {
  const account = await prisma.account.findFirst({
    where: {
      userId: req.userId,
      providerId: 'google',
    },
  });

  if (!account) {
    return null;
  }

  const tokenResult = await auth.api.getAccessToken({
    body: {
      accountId: account.id,
    },
    headers: req.headers,
  });

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');

  const now = new Date();
  const timeMax = new Date();

  timeMax.setDate(timeMax.getDate() + 30);

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
    throw new Error('Failed to fecth Google Calendar events');
  }

  const data = (await googleResponse.json()) as GoogleCalendarResponse;

  return data.items ?? [];
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

    if (events === null) {
      return res.status(200).json({
        connected: false,
        suggestions: [],
      });
    }

    const suggestions = (events as GoogleCalendarEvent[]).map((event) => ({
      id: event.id,
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

export default router;
