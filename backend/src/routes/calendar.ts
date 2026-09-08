import { Router } from 'express';
import { auth } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

router.post('/connect', authenticate, async (req, res) => {
  try {
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
    console.error('Google Calender connect error:', error);

    return res.status(400).json({
      error: 'Failed to connect Google Calendar',
    });
  }
});

export default router;
