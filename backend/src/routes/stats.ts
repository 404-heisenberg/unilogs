import { Router } from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/authenticate.js';
import { getWeeklyEntryCounts, getTermTotals } from '../utils/stats-helper.js';
import { computeCurrentStreak } from '../services/stats-services.js';

const router = Router();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await prisma.project.findMany({
      where: { userId, archived: false },
      include: {
        fields: {
          where: { fieldType: 'duration' },
        },
        entries: {
          select: {
            content: true,
          },
        },
      },
    });

    const perProject = projects.map((project) => {
      const durationFieldNames = project.fields.map((f) => f.name);

      let totalHours = 0;
      for (const entry of project.entries) {
        const content = entry.content as Record<string, unknown>;
        for (const fieldName of durationFieldNames) {
          const value = content[fieldName];
          if (typeof value === 'number') {
            totalHours += value;
          }
        }
      }

      return {
        projectId: project.id,
        projectName: project.name,
        totalHours,
      };
    });

    const totalHours = perProject.reduce((sum, p) => sum + p.totalHours, 0);

    const streak = await computeCurrentStreak(userId);

    return res.status(200).json({
      perProject,
      totalHours,
      streak,
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/frequency', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const weeklyCounts = await getWeeklyEntryCounts(userId);
    const termTotals = getTermTotals(weeklyCounts);

    return res.status(200).json({
      weekly: weeklyCounts,
      terms: termTotals,
    });
  } catch (err) {
    console.error('GET /api/stats/frequency error:', err);
    return res.status(500).json({ error: 'Failed to fetch frequency stats' });
  }
});

router.get('/streak', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const streak = await computeCurrentStreak(userId);

    return res.status(200).json({ streak });
  } catch (err) {
    console.error('GET /api/stats/streak error:', err);
    return res.status(500).json({ error: 'Failed to fetch streak' });
  }
});

export default router;
