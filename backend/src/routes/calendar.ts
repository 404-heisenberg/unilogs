import { Router } from 'express';
import { auth, prisma } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

type GoogleCalendarResponse = {
  items?: unknown[];
};

router.post('/connect', authenticate, async (req, res) => {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: req.userId,
        providerId: 'google',
      },
    });

    if (account) {
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
      },
      headers: req.headers,
    });

    return res.status(200).json({
      url: result.url,
    });
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

    const tokenResult = await auth.api.getAccessToken({
      body: {
        accountId: account.id,
      },
      headers: req.headers,
    });

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');

    url.searchParams.set('timeMin', new Date().toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '20');

    const googleResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!googleResponse.ok) {
      return res.status(502).json({
        error: 'Failed to fetch Google Calendar events',
      });
    }

    const data = (await googleResponse.json()) as GoogleCalendarResponse;

    const events = data.items ?? [];

    return res.status(200).json({
      connected: true,
      events,
    });
  } catch (error) {
    console.error('Google Calendar events error:', error);

    return res.status(500).json({
      error: 'Failed to fetch Google Calendar events',
    });
  }
});

export default router;
