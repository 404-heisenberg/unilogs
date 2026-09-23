import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../auth.js';
import { buildCsv } from '../services/export-service.js';
import { getOwnedProject } from './projects.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = Number(req.query.projectId);
    if (!Number.isInteger(projectId)) {
      return res.status(400).json({ error: 'projectId must be a valid integer' });
    }

    const format = req.query.format;
    if (format !== 'csv' && format !== 'md') {
      return res.status(400).json({ error: 'format must be csv or md' });
    }

    const includeBodies = req.query.includeBodies === 'true';

    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    const fromDate = dateFrom
      ? new Date(String(dateFrom))
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = dateTo ? new Date(String(dateTo)) : new Date();
    if (dateTo) {
      toDate.setUTCDate(toDate.getUTCDate() + 1);
    }

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ error: 'dateFrom must be before dateTo' });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'project not found' });
    }

    const safeProjectName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-');

    const rangeEnd = dateTo
      ? new Date(String(dateTo)).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const range = `${fromDate.toISOString().slice(0, 10)}-to-${rangeEnd}`;

    const fields = await prisma.fieldDefinition.findMany({
      where: {
        projectId: projectId,
      },
    });

    const entries = await prisma.entry.findMany({
      where: {
        projectId: projectId,
        date: {
          gte: fromDate,
          lt: toDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const exportEntries = entries.map((entry) => {
      if (includeBodies) {
        return entry;
      }

      const entryWithoutBody = { ...entry };
      delete (entryWithoutBody as { body?: string | null }).body;
      return entryWithoutBody;
    });

    if (format === 'csv') {
      const csv = buildCsv(exportEntries, fields);
      res.type('text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="unilogs-${safeProjectName}-${range}.csv"`,
      );

      return res.send(csv);
    }
  } catch {
    return res.status(500).json({ error: 'Failed to export entries' });
  }
});

export default router;
