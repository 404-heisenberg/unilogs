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

router.get('/project/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = parseInt(String(req.params.projectId), 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'projectId must be a valid integer' });
    }

    const perProject = await prisma.project.findMany({
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

    const project = perProject.find((p) => p.id === projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

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

    return res.status(200).json({
      projectId: project.id,
      projectName: project.name,
      totalHours,
    });
  } catch (err) {
    console.error('GET /api/stats/project/:projectId error:', err);
    return res.status(500).json({ error: 'Failed to fetch project stats' });
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

type UnfinishedItem = {
  entryId: number;
  fieldName: string;
  label: string;
  projectName: string;
  dueDate: string | null;
};

router.get('/unfinished', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await prisma.project.findMany({
      where: { userId, archived: false },
      include: {
        fields: true,
        entries: {
          select: { id: true, title: true, content: true },
        },
      },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (7 - endOfWeek.getUTCDay()));
    endOfWeek.setUTCHours(23, 59, 59, 999);

    const overdue: UnfinishedItem[] = [];
    const dueThisWeek: UnfinishedItem[] = [];
    const noDueDate: UnfinishedItem[] = [];

    for (const project of projects) {
      const booleanFields = project.fields.filter((f) => f.fieldType === 'boolean');
      if (booleanFields.length === 0) continue;

      // There's no dedicated due-date concept in the schema. The first
      // date-type field defined for a project doubles as the due date for
      // any boolean ("todo") field left unfinished on an entry — reusing
      // the same custom-field system the rest of the app is built on,
      // rather than inventing a parallel one.
      const dueDateField = project.fields.find((f) => f.fieldType === 'date');

      for (const entry of project.entries) {
        const content = entry.content as Record<string, unknown>;

        for (const field of booleanFields) {
          if (content[field.name] === true) continue;

          const rawDue = dueDateField ? content[dueDateField.name] : undefined;
          const dueDate = typeof rawDue === 'string' ? rawDue : null;

          const firstText = Object.values(content).find(
            (value): value is string => typeof value === 'string' && value.trim() !== '',
          );
          const label = entry.title?.trim() || firstText?.trim() || 'Untitled entry';

          const item: UnfinishedItem = {
            entryId: entry.id,
            fieldName: field.name,
            label,
            projectName: project.name,
            dueDate,
          };

          if (dueDate === null) {
            noDueDate.push(item);
            continue;
          }

          const due = new Date(dueDate);
          if (due < today) overdue.push(item);
          else if (due <= endOfWeek) dueThisWeek.push(item);
          else noDueDate.push(item);
        }
      }
    }

    return res.status(200).json({ overdue, dueThisWeek, noDueDate });
  } catch (err) {
    console.error('GET /api/stats/unfinished error:', err);
    return res.status(500).json({ error: 'Failed to fetch unfinished items' });
  }
});

export default router;
