import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../auth.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { remindersEnabled: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ remindersEnabled: user.remindersEnabled });
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { remindersEnabled } = req.body;
    if (remindersEnabled !== undefined && typeof remindersEnabled !== 'boolean') {
      return res.status(400).json({ error: 'remindersEnabled must be a boolean' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { remindersEnabled: remindersEnabled ?? undefined },
      select: { remindersEnabled: true },
    });

    return res.status(200).json({ remindersEnabled: user.remindersEnabled });
  } catch (err) {
    console.error('PATCH /api/settings error:', err);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
