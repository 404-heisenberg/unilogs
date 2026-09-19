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

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: { select: { entries: true } },
      },
    });

    const result = tags
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        usageCount: tag._count.entries,
      }))
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
        return a.name.localeCompare(b.name);
      });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/tags error:', err);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }

    const existing = await prisma.tag.findFirst({
      where: {
        userId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Tag with this name already exists' });
    }

    const tag = await prisma.tag.create({
      data: { name: trimmedName, userId },
    });

    return res.status(201).json({ id: tag.id, name: tag.name, usageCount: 0 });
  } catch (err) {
    console.error('POST /api/tags error:', err);
    return res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this tag' });
    }

    const duplicate = await prisma.tag.findFirst({
      where: {
        userId,
        name: { equals: trimmedName, mode: 'insensitive' },
        NOT: { id },
      },
    });

    if (duplicate) {
      return res.status(409).json({ error: 'Tag with this name already exists' });
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: { name: trimmedName },
      include: { _count: { select: { entries: true } } },
    });

    return res.status(200).json({
      id: updated.id,
      name: updated.name,
      usageCount: updated._count.entries,
    });
  } catch (err) {
    console.error('PATCH /api/tags/:id error:', err);
    return res.status(500).json({ error: 'Failed to update tag' });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this tag' });
    }

    await prisma.$transaction([
      prisma.entryTag.deleteMany({ where: { tagId: id } }),
      prisma.tag.delete({ where: { id } }),
    ]);

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/tags/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
