import { Router } from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/authenticate.js';

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
      where: { userId },
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

    return res.status(200).json({ perProject, totalHours });
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
      where: { userId },
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

export default router;
