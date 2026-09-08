import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// GET /api/entries - Fetch entries with project relational data
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const entries = await prisma.entry.findMany({
      where: {
        project: { userId },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json(entries);
  } catch (err) {
    console.error('GET /api/entries error:', err);
    return res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

export default router;
