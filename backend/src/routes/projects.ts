import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../auth.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// GET /api/projects - Include entries array and count aggregation
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        entries: {
          select: { id: true },
        },
        _count: {
          select: { entries: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    return res.status(200).json(projects);
  } catch (err) {
    console.error('GET /api/projects primary query failed, running fallback:', err);
    try {
      const projects = await prisma.project.findMany({ where: { userId: req.userId } });
      return res.status(200).json(projects);
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }
});

export default router;
