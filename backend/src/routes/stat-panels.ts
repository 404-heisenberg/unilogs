import { Router } from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPanelsForProject,
  createPanel,
  computePanelValue,
  type Aggregation,
} from '../services/stat-panel-service.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = Router({ mergeParams: true });

async function getOwnedProject(projectId: number, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

function isAggregation(v: unknown): v is Aggregation {
  return v === 'sum' || v === 'average';
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const includeHidden = req.query.includeHidden === 'true';
    const panels = await listPanelsForProject(userId, projectId, { includeHidden });
    return res.status(200).json(panels);
  } catch (err) {
    console.error('GET stat-panels error:', err);
    return res.status(500).json({ error: 'Failed to fetch panels' });
  }
});

router.post('/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { expression, aggregation = 'sum', rangeDays = 30 } = req.body ?? {};

    if (typeof expression !== 'string' || expression.trim().length === 0) {
      return res.status(400).json({ error: 'expression is required' });
    }
    if (!isAggregation(aggregation)) {
      return res.status(400).json({ error: 'aggregation must be sum or average' });
    }
    if (typeof rangeDays !== 'number' || rangeDays < 1) {
      return res.status(400).json({ error: 'rangeDays must be a positive integer' });
    }

    const computed = await computePanelValue(projectId, expression, aggregation, rangeDays);
    return res.status(200).json(computed);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('POST stat-panels/preview error:', err);
    return res.status(500).json({ error: 'Preview failed' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, expression, aggregation, rangeDays, hidden } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (typeof expression !== 'string' || expression.trim().length === 0) {
      return res.status(400).json({ error: 'expression is required' });
    }
    if (aggregation !== undefined && !isAggregation(aggregation)) {
      return res.status(400).json({ error: 'aggregation must be sum or average' });
    }
    if (rangeDays !== undefined && (typeof rangeDays !== 'number' || rangeDays < 1)) {
      return res.status(400).json({ error: 'rangeDays must be a positive integer' });
    }
    if (hidden !== undefined && typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const panel = await createPanel(userId, projectId, {
      name: name.trim(),
      expression,
      aggregation: aggregation as Aggregation | undefined,
      rangeDays,
      hidden,
    });
    return res.status(201).json(panel);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('POST stat-panels error:', err);
    return res.status(500).json({ error: 'Failed to create panel' });
  }
});

router.patch('/:panelId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const panelId = parseInt(String(req.params.panelId), 10);
    if (Number.isNaN(panelId)) {
      return res.status(400).json({ error: 'panelId must be a valid integer' });
    }

    const panel = await prisma.statPanel.findUnique({ where: { id: panelId } });
    if (!panel) return res.status(404).json({ error: 'Panel not found' });
    if (panel.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this panel' });
    }

    const { name, position, rangeDays, aggregation, expression, hidden } = req.body ?? {};

    if (aggregation !== undefined && !isAggregation(aggregation)) {
      return res.status(400).json({ error: 'aggregation must be sum or average' });
    }
    if (rangeDays !== undefined && (typeof rangeDays !== 'number' || rangeDays < 1)) {
      return res.status(400).json({ error: 'rangeDays must be a positive integer' });
    }
    if (hidden !== undefined && typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'hidden must be a boolean' });
    }

    const updated = await prisma.statPanel.update({
      where: { id: panelId },
      data: {
        name: typeof name === 'string' ? name.trim() : undefined,
        position: typeof position === 'number' ? position : undefined,
        rangeDays: typeof rangeDays === 'number' ? rangeDays : undefined,
        aggregation: isAggregation(aggregation) ? aggregation : undefined,
        expression: typeof expression === 'string' ? expression : undefined,
        hidden: typeof hidden === 'boolean' ? hidden : undefined,
      },
    });

    const computed = await computePanelValue(
      updated.projectId,
      updated.expression,
      updated.aggregation as Aggregation,
      updated.rangeDays,
    );

    return res.status(200).json({ ...updated, ...computed });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    console.error('PATCH stat-panel error:', err);
    return res.status(500).json({ error: 'Failed to update panel' });
  }
});

router.delete('/:panelId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const panelId = parseInt(String(req.params.panelId), 10);
    if (Number.isNaN(panelId)) {
      return res.status(400).json({ error: 'panelId must be a valid integer' });
    }

    const panel = await prisma.statPanel.findUnique({ where: { id: panelId } });
    if (!panel) return res.status(404).json({ error: 'Panel not found' });
    if (panel.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this panel' });
    }

    await prisma.statPanel.delete({ where: { id: panelId } });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE stat-panel error:', err);
    return res.status(500).json({ error: 'Failed to delete panel' });
  }
});

export default router;
