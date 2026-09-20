import { Router } from 'express';
import type { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { authenticate } from '../middleware/authenticate.js';
import { validateEntryContent, isWhollyEmpty } from '../lib/validateEntry.js';
import { parseEntryListQuery } from '../lib/entryFilters.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const router = Router();

async function getOwnedProject(projectId: number, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { fields: true },
  });
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = parseEntryListQuery(
      {
        q: req.query.q as string | undefined,
        projectId: req.query.projectId as string | undefined,
        tagIds: req.query.tagIds as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page as string | undefined,
        limit: req.query.limit as string | undefined,
      },
      userId,
    );

    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error });
    }

    const [entries, total] = await Promise.all([
      prisma.entry.findMany({
        where: parsed.where,
        include: {
          tags: { include: { tag: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: parsed.skip,
        take: parsed.take,
      }),
      prisma.entry.count({ where: parsed.where }),
    ]);

    return res.status(200).json({
      entries,
      total,
      page: parsed.page,
      limit: parsed.limit,
    });
  } catch (err) {
    console.error('GET /api/entries error:', err);
    return res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId, content, date, tagIds, title, body } = req.body;

    if (!projectId || !content) {
      return res.status(400).json({ error: 'projectId and content are required' });
    }

    const projectIdInt = parseInt(projectId, 10);
    if (Number.isNaN(projectIdInt)) {
      return res.status(400).json({ error: 'projectId must be a valid integer' });
    }

    const project = await getOwnedProject(projectIdInt, userId);
    if (!project) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }
    if (tagIds && tagIds.length > 0) {
      const ownedTags = await prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          userId: userId,
        },
        select: { id: true },
      });

      if (ownedTags.length !== tagIds.length) {
        return res.status(403).json({ error: 'One or more tags do not belong to you' });
      }
    }
    const contentErrors = validateEntryContent(content, project.fields);
    if (contentErrors.length > 0) {
      return res.status(400).json({ errors: contentErrors });
    }
    if (isWhollyEmpty(title, body, content)) {
      return res.status(400).json({
        errors: ['Entry must have a title, body, or at least one field value'],
      });
    }

    const entry = await prisma.entry.create({
      data: {
        projectId: projectIdInt,
        content,
        date: date ? new Date(date) : new Date(),
        title: title ?? null,
        body: body ?? null,
        tags:
          tagIds && tagIds.length
            ? { create: tagIds.map((tagId: number) => ({ tag: { connect: { id: tagId } } })) }
            : undefined,
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entryId: entry.id,
        action: 'CREATE',
        newData: JSON.parse(JSON.stringify(entry)),
      },
    });

    return res.status(201).json(entry);
  } catch (err) {
    console.error('POST /api/entries error:', err);
    return res.status(500).json({ error: 'Failed to create entry' });
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

    const entry = await prisma.entry.findUnique({
      where: { id },
      include: {
        project: true,
        tags: { include: { tag: true } },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this entry' });
    }

    return res.status(200).json(entry);
  } catch (err) {
    console.error('GET /api/entries/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch entry' });
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
    const { content, date, tagIds, title, body } = req.body;

    const existing = await prisma.entry.findUnique({
      where: { id },
      include: { project: { include: { fields: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (existing.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this entry' });
    }
    if (tagIds && tagIds.length > 0) {
      const ownedTags = await prisma.tag.findMany({
        where: {
          id: { in: tagIds },
          userId: userId,
        },
        select: { id: true },
      });

      if (ownedTags.length !== tagIds.length) {
        return res.status(403).json({ error: 'One or more tags do not belong to you' });
      }
    }
    if (content !== undefined) {
      const contentErrors = validateEntryContent(content, existing.project.fields);
      if (contentErrors.length > 0) {
        return res.status(400).json({ errors: contentErrors });
      }
    }
    const mergedTitle = title !== undefined ? title : existing.title;
    const mergedBody = body !== undefined ? body : existing.body;
    const mergedContent =
      content !== undefined ? content : (existing.content as Record<string, unknown>);

    if (isWhollyEmpty(mergedTitle, mergedBody, mergedContent)) {
      return res.status(400).json({
        errors: ['Entry must have a title, body, or at least one field value'],
      });
    }
    const updated = await prisma.entry.update({
      where: { id },
      data: {
        content: content ?? undefined,
        date: date ? new Date(date) : undefined,
        title: title ?? undefined,
        body: body ?? undefined,
        tags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId: number) => ({ tag: { connect: { id: tagId } } })),
            }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entryId: id,
        action: 'UPDATE',
        oldData: JSON.parse(JSON.stringify(existing)),
        newData: JSON.parse(JSON.stringify(updated)),
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('PUT /api/entries/:id error:', err);
    return res.status(500).json({ error: 'Failed to update entry' });
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

    const existing = await prisma.entry.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (existing.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this entry' });
    }

    await prisma.auditLog.create({
      data: {
        entryId: id,
        action: 'DELETE',
        oldData: JSON.parse(JSON.stringify(existing)),
      },
    });

    await prisma.auditLog.deleteMany({
      where: { entryId: id },
    });

    await prisma.entry.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/entries/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

export default router;
