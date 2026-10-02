import { prisma, prismaWithDeleted } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  readEntrySnapshot,
  toAuditData,
  toEntrySnapshot,
  type EntrySnapshot,
} from '../lib/audit-snapshot.js';
import { validateEntryContent, isWhollyEmpty } from '../lib/validateEntry.js';

// Entry history and recovery. Three rules hold everywhere in here:
//
// 1. History is append-only. Restoring never rewrites or deletes an audit row;
//    it applies the old values and writes a *new* UPDATE row whose `oldData`
//    is the state being replaced. The version list is therefore a complete
//    record of what happened, not a ring buffer.
// 2. Every read is owner-scoped. A project that is not the caller's is a 404
//    where the entry id is involved, so ids cannot be probed.
// 3. Deleted rows are reached only through `prismaWithDeleted`. `prisma` hides
//    them, which is what makes the trash and the restore routes work.

export interface EntryVersion {
  auditId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  modifiedAt: Date;
  snapshot: EntrySnapshot | null;
}

export async function listEntryVersions(entryId: number): Promise<EntryVersion[] | null> {
  const rows = await prismaWithDeleted.auditLog.findMany({
    where: { entryId },
    // Newest first. `id` breaks the tie so two rows written in the same
    // millisecond keep a stable order - TIMESTAMP(3) is not unique.
    orderBy: [{ modifiedAt: 'desc' }, { id: 'desc' }],
  });

  if (rows.length === 0) return null;

  return rows.map((row) => ({
    auditId: row.id,
    action: row.action,
    modifiedAt: row.modifiedAt,
    // A DELETE row keeps the state it removed in `oldData`.
    snapshot: readEntrySnapshot(row.newData ?? row.oldData),
  }));
}

export type RestoreOutcome =
  | { ok: true; entry: unknown; tagsChanged: boolean }
  | { ok: false; status: number; errors?: string[] };

export async function restoreEntryVersion(
  userId: string,
  entryId: number,
  auditId: number,
): Promise<RestoreOutcome> {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, project: { userId } },
    include: { project: { include: { fields: true } }, tags: true },
  });

  if (!entry) return { ok: false, status: 404 };

  const version = await prismaWithDeleted.auditLog.findFirst({
    where: { id: auditId, entryId },
  });

  if (!version) return { ok: false, status: 404 };

  const snapshot = readEntrySnapshot(version.newData ?? version.oldData);
  if (!snapshot) return { ok: false, status: 409 };

  const content = snapshot.content as Record<string, unknown>;
  const contentErrors = validateEntryContent(content, entry.project.fields);
  if (contentErrors.length > 0) {
    // Reachable: a field can be renamed or removed after the version was
    // written, and then the old version no longer satisfies the project's
    // field definitions. Refusing beats writing an entry the project can no
    // longer display.
    return { ok: false, status: 400, errors: contentErrors };
  }

  if (isWhollyEmpty(snapshot.title, snapshot.body, content)) {
    return { ok: false, status: 400, errors: ['That version is empty and cannot be restored'] };
  }

  const tagIds = await resolveTagIds(userId, snapshot.tagIds);
  const auditBefore = toAuditData(toEntrySnapshot(entry));

  const updated = await prisma.$transaction(async (tx) => {
    const restored = await tx.entry.update({
      where: { id: entryId },
      data: {
        title: snapshot.title,
        body: snapshot.body,
        content: content as Prisma.InputJsonObject,
        date: new Date(snapshot.date),
        // `undefined` leaves tags alone, which is the behaviour for legacy
        // snapshots whose tag list was never captured.
        tags:
          tagIds === undefined
            ? undefined
            : {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
              },
      },
      include: { tags: true },
    });

    await tx.auditLog.create({
      data: {
        entryId,
        action: 'UPDATE',
        oldData: auditBefore,
        newData: toAuditData(toEntrySnapshot(restored)),
      },
    });

    return restored;
  });

  return { ok: true, entry: updated, tagsChanged: tagIds !== undefined };
}

export async function listProjectTrash(userId: string, projectId: number) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });

  if (!project) return null;

  const entries = await prismaWithDeleted.entry.findMany({
    where: { projectId, deletedAt: { not: null } },
    include: { tags: { include: { tag: true } } },
    orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
  });

  return { project, entries };
}

export type UndeleteOutcome =
  { ok: true; entry: unknown } | { ok: false; status: number; error: string };

export async function undeleteEntry(userId: string, entryId: number): Promise<UndeleteOutcome> {
  const entry = await prismaWithDeleted.entry.findFirst({
    where: { id: entryId, project: { userId } },
    include: { project: true, tags: true },
  });

  if (!entry) return { ok: false, status: 404, error: 'Entry not found' };

  if (!entry.deletedAt) {
    return { ok: false, status: 409, error: 'Entry is not deleted' };
  }

  const restored = await prisma.$transaction(async (tx) => {
    const result = await tx.entry.update({
      where: { id: entryId },
      data: { deletedAt: null },
      include: { tags: { include: { tag: true } } },
    });

    // An UPDATE row rather than a DELETE-shaped one, because the entry is
    // live again. The as-at reconstruction reads liveness from the action of
    // the newest audit row, so this row is what makes the entry reappear for
    // dates after today.
    await tx.auditLog.create({
      data: {
        entryId,
        action: 'UPDATE',
        oldData: toAuditData(toEntrySnapshot(entry)),
        newData: toAuditData(toEntrySnapshot(result)),
      },
    });

    return result;
  });

  return { ok: true, entry: restored };
}

/**
 * Tags are filtered to the ones the user still owns. A tag can be deleted
 * between a version being written and being restored, and `connect` throws on
 * a missing id - which would turn a recoverable restore into a 500.
 */
async function resolveTagIds(
  userId: string,
  tagIds: number[] | undefined,
): Promise<number[] | undefined> {
  if (tagIds === undefined) return undefined;
  if (tagIds.length === 0) return [];

  const owned = await prisma.tag.findMany({
    where: { id: { in: tagIds }, userId },
    select: { id: true },
  });

  return owned.map((tag) => tag.id);
}
