import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../auth.js';
import type { RequestHandler } from 'express';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required!' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name,
        description: description ?? null,
        userId: req.userId,
      },
    });

    return res.status(201).json(project);
  } catch {
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const archived = req.query.archived === 'true';

    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId,
        archived: archived,
      },
    });

    return res.status(200).json(projects);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

async function getOwnedProject(id: number, userId: string) {
  return prisma.project.findFirst({
    where: { id: id, userId },
  });
}

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const { name, description } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ error: 'name must be a string and non empty' });
    }

    if (description !== undefined && description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be a string' });
    }

    const project = await getOwnedProject(id, userId);
    if (!project) return res.status(404).json({ error: 'project not found' });

    const update = await prisma.project.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description,
      },
    });

    return res.status(200).json(update);
  } catch (err) {
    console.error('PATCH /api/projects/:id error:', err);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

function setArchived(archived: boolean, action: string): RequestHandler {
  return async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Not Authenticated' });

      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'id must be a valid integer' });
      }

      const project = await getOwnedProject(id, userId);
      if (!project) return res.status(404).json({ error: 'project not found' });

      const update = await prisma.project.update({
        where: { id },
        data: {
          archived: archived,
        },
      });

      return res.status(200).json(update);
    } catch (err) {
      console.error(`POST /api/projects/${action} error:`, err);
      return res.status(500).json({ error: 'Failed to update archive status of project' });
    }
  };
}

router.post('/:id/archive', authenticate, setArchived(true, 'archive'));
router.post('/:id/unarchive', authenticate, setArchived(false, 'unarchive'));

export default router;
