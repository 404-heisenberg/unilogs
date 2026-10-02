import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma, prismaWithDeleted } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateEntryContent, isWhollyEmpty } from '../lib/validateEntry.js';
import { parseEntryListQuery } from '../lib/entryFilters.js';
import { toAuditData, toEntrySnapshot } from '../lib/audit-snapshot.js';
import {
  listEntryVersions,
  restoreEntryVersion,
  undeleteEntry,
} from '../services/entry-history-service.js';
import { parseAsAtDate, reconstructAsAt } from '../services/asat-service.js';

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
        newData: toAuditData(toEntrySnapshot(entry)),
      },
    });

    return res.status(201).json(entry);
  } catch (err) {
    console.error('POST /api/entries error:', err);
    return res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Read-only reconstruction of the logbook as it stood on a given date. Must
// stay above `GET /:id`, or `as-at` is parsed as an entry id and 400s.
router.get('/as-at', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cutoff = parseAsAtDate(req.query.date);
    if (!cutoff) {
      return res.status(400).json({ error: 'date is required as YYYY-MM-DD' });
    }

    let projectId: number | undefined;
    if (req.query.projectId !== undefined) {
      const parsed = Number(req.query.projectId);
      if (!Number.isInteger(parsed)) {
        return res.status(400).json({ error: 'projectId must be a valid integer' });
      }
      projectId = parsed;
    }

    const entries = await reconstructAsAt(userId, cutoff, { projectId });

    return res.status(200).json({
      entries,
      total: entries.length,
      // The day asked for, echoed back because the cutoff itself is exclusive
      // and midnight the following day is not a useful thing to show a caller.
      date: String(req.query.date).trim(),
    });
  } catch (err) {
    console.error('GET /api/entries/as-at error:', err);
    return res.status(500).json({ error: 'Failed to reconstruct entries' });
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
      // `tags` is loaded so the pre-edit snapshot records which tags the entry
      // had. Without it a restored version could never put them back.
      include: { project: { include: { fields: true } }, tags: true },
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
        oldData: toAuditData(toEntrySnapshot(existing)),
        newData: toAuditData(toEntrySnapshot(updated)),
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('PUT /api/entries/:id error:', err);
    return res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Soft delete. The row stays, stamped with `deletedAt`, so the deletion can be
// undone from `GET /api/projects/:id/trash`. Its audit rows stay too - this
// route used to write a DELETE audit row and then immediately delete every
// audit row for the entry, which left nothing to recover and nothing to read.
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

    // `prisma` hides soft-deleted rows, so an entry that is already in the
    // trash is a 404 here rather than a second delete.
    const existing = await prisma.entry.findUnique({
      where: { id },
      include: { project: true, tags: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (existing.project.userId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this entry' });
    }

    await prismaWithDeleted.$transaction(async (tx) => {
      await tx.entry.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          entryId: id,
          action: 'DELETE',
          // The state being removed, so the as-at view can still show this
          // entry for any date before the deletion.
          oldData: toAuditData(toEntrySnapshot(existing)),
        },
      });
    });

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/entries/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.get('/:id/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const entry = await prisma.entry.findFirst({
      where: { id, project: { userId } },
      select: { id: true },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const versions = await listEntryVersions(id);
    if (!versions) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    return res.status(200).json({ versions });
  } catch (err) {
    console.error('GET /api/entries/:id/history error:', err);
    return res.status(500).json({ error: 'Failed to fetch entry history' });
  }
});

router.post('/:id/history/:auditId/restore', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    const auditId = parseInt(String(req.params.auditId), 10);
    if (Number.isNaN(id) || Number.isNaN(auditId)) {
      return res.status(400).json({ error: 'id and auditId must be valid integers' });
    }

    const result = await restoreEntryVersion(userId, id, auditId);

    if (!result.ok) {
      if (result.status === 400 && result.errors) {
        return res.status(400).json({ errors: result.errors });
      }
      return res.status(result.status).json({ error: 'Version not found' });
    }

    return res.status(200).json({
      entry: result.entry,
      tagsChanged: result.tagsChanged,
    });
  } catch (err) {
    console.error('POST /api/entries/:id/history/:auditId/restore error:', err);
    return res.status(500).json({ error: 'Failed to restore version' });
  }
});

router.post('/:id/restore', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const result = await undeleteEntry(userId, id);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json(result.entry);
  } catch (err) {
    console.error('POST /api/entries/:id/restore error:', err);
    return res.status(500).json({ error: 'Failed to restore entry' });
  }
});

export default router;
