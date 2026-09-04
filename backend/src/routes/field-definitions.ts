import { Router } from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/authenticate.js';
import { FIELD_TYPES } from '../types/field-types.js';
import { z } from 'zod';
const fieldTypeSchema = z.enum(FIELD_TYPES);

const router = Router();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function getOwnedProject(projectId: number, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = parseInt(req.query.projectId as string, 10);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'projectId must be a valid integer' });
    }

    const project = await getOwnedProject(projectId, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const fieldDefinitions = await prisma.fieldDefinition.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    });

    return res.status(200).json(fieldDefinitions);
  } catch (err) {
    console.error('GET /api/field-definitions error:', err);
    return res.status(500).json({ error: 'Failed to fetch field definitions' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, name, fieldType } = req.body;

    if (!projectId || !name || !fieldType) {
      return res.status(400).json({ error: 'projectId, name, and fieldType are required' });
    }

    const fieldTypeResult = fieldTypeSchema.safeParse(fieldType);

    if (!fieldTypeResult.success) {
      return res.status(400).json({
        error: `Invalid field type. Valid options are: ${FIELD_TYPES.join(', ')}`,
      });
    }

    const projectIdInt = parseInt(projectId, 10);
    if (Number.isNaN(projectIdInt)) {
      return res.status(400).json({ error: 'projectId must be a valid integer' });
    }

    const project = await getOwnedProject(projectIdInt, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const fieldDefinition = await prisma.fieldDefinition.create({
      data: {
        projectId: projectIdInt,
        name,
        fieldType,
      },
    });

    return res.status(201).json(fieldDefinition);
  } catch (err) {
    console.error('POST /api/field-definitions error:', err);
    return res.status(500).json({ error: 'Failed to create field definition' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const fieldDefinition = await prisma.fieldDefinition.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!fieldDefinition) {
      return res.status(404).json({ error: 'Field definition not found' });
    }

    if (fieldDefinition.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this field definition' });
    }

    return res.status(200).json(fieldDefinition);
  } catch (err) {
    console.error('GET /api/field-definitions/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch field definition' });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const { name, fieldType } = req.body;

    if (fieldType !== undefined) {
      const fieldTypeResult = fieldTypeSchema.safeParse(fieldType);

      if (!fieldTypeResult.success) {
        return res.status(400).json({
          error: `Invalid field type. Valid options are: ${FIELD_TYPES.join(', ')}`,
        });
      }
    }

    const existing = await prisma.fieldDefinition.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Field definition not found' });
    }

    if (existing.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this field definition' });
    }

    const updated = await prisma.fieldDefinition.update({
      where: { id },
      data: {
        name: name ?? undefined,
        fieldType: fieldType ?? undefined,
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('PUT /api/field-definitions/:id error:', err);
    return res.status(500).json({ error: 'Failed to update field definition' });
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

    const existing = await prisma.fieldDefinition.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Field definition not found' });
    }

    if (existing.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this field definition' });
    }

    await prisma.fieldDefinition.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/field-definitions/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete field definition' });
  }
});

export default router;
