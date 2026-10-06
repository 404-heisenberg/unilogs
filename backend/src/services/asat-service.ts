import { prisma, prismaWithDeleted } from '../lib/prisma.js';
import { readEntrySnapshot, type EntrySnapshot } from '../lib/audit-snapshot.js';

/**
 * A reconstructed entry, in the shape `GET /api/entries` returns so the
 * timeline can render both from one component.
 */
export type AsAtEntry = {
  id: number;
  projectId: number;
  title: string | null;
  body: string | null;
  content: unknown;
  /** The date the entry carried *at that moment*, which may differ from now. */
  date: string;
  project: { id: number; name: string };
  tags: { tagId: number; tag: { id: number; name: string; userId: string } }[];
};

export type AsAtOptions = {
  /** Restrict to one project. Must belong to the user. */
  projectId?: number;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `date=2026-09-08` means the state at the **end** of that day, not its start.
 * A user asking "what did the logbook say on the 8th" means everything logged
 * during the 8th, so the cutoff is the following midnight and the comparison
 * is exclusive.
 */
export function parseAsAtDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw.trim())) return null;

  const cutoff = new Date(`${raw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(cutoff.getTime())) return null;

  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return cutoff;
}

/**
 * Reconstructs the logbook as it stood at `cutoff`.
 *
 * The state of an entry at a moment is decided by its newest audit row at or
 * before that moment:
 *
 *   - `CREATE` or `UPDATE` - it existed, and the row's `newData` is its content
 *   - `DELETE`           - it had already been deleted, so it is not shown
 *
 * That single rule covers both directions of the interesting cases for free: an
 * entry deleted *after* the cutoff still has a CREATE/UPDATE row as its newest
 * one and appears with its pre-delete content, while an entry created after the
 * cutoff has no row at all and does not appear.
 *
 * Rows are read through `prismaWithDeleted` - soft-deleted entries are the
 * whole point of the exercise, and the default client hides them.
 */
export async function reconstructAsAt(
  userId: string,
  cutoff: Date,
  options: AsAtOptions = {},
): Promise<AsAtEntry[]> {
  const rows = await prismaWithDeleted.auditLog.findMany({
    where: {
      modifiedAt: { lt: cutoff },
      entry: {
        createdAt: { lte: cutoff },
        // Defensive rather than load-bearing: the audit rule already excludes
        // anything deleted before the cutoff. This catches an entry whose
        // DELETE row is missing.
        OR: [{ deletedAt: null }, { deletedAt: { gt: cutoff } }],
        project: {
          userId,
          archived: false,
          ...(options.projectId !== undefined ? { id: options.projectId } : {}),
        },
      },
    },
    select: {
      entryId: true,
      action: true,
      newData: true,
      entry: {
        select: {
          id: true,
          projectId: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { modifiedAt: 'desc' },
  });

  // Newest row per entry wins. Prisma's `distinct` is not a guaranteed
  // push-down, so the first row seen for an entry is its latest one.
  const latest = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.entryId)) latest.set(row.entryId, row);
  }

  const visible: { entry: AsAtEntry; snapshot: EntrySnapshot }[] = [];

  for (const row of latest.values()) {
    // A DELETE as the newest row means it was already gone at the cutoff.
    if (row.action === 'DELETE') continue;

    const snapshot = readEntrySnapshot(row.newData);
    // Every CREATE and UPDATE writes a snapshot. A row without one is a write
    // this route cannot reconstruct, and guessing would invent content.
    if (!snapshot) continue;

    visible.push({
      snapshot,
      entry: {
        id: row.entry.id,
        projectId: row.entry.projectId,
        title: snapshot.title,
        body: snapshot.body,
        content: snapshot.content,
        date: snapshot.date,
        project: row.entry.project,
        tags: [],
      },
    });
  }

  // Tag names are not in the snapshot - only ids - and the timeline renders
  // names, so they are resolved in one query rather than per entry. The whole
  // tag row is returned so this matches what `GET /api/entries` gives back.
  const tagIds = [...new Set(visible.flatMap(({ snapshot }) => snapshot.tagIds ?? []))];
  const tags = tagIds.length
    ? await prisma.tag.findMany({ where: { id: { in: tagIds }, userId } })
    : [];
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  for (const item of visible) {
    item.entry.tags = (item.snapshot.tagIds ?? []).flatMap((tagId) => {
      const tag = tagsById.get(tagId);
      // A tag deleted since the cutoff cannot be shown. It is left off rather
      // than rendered as a dangling id.
      return tag ? [{ tagId, tag }] : [];
    });
  }

  // Same ordering as the timeline: newest entry date first.
  visible.sort((left, right) => right.entry.date.localeCompare(left.entry.date));

  return visible.map((item) => item.entry);
}
