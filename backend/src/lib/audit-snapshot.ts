import { Prisma } from '../generated/prisma/client.js';

// Entry versions live in `AuditLog.oldData` / `newData`. Those columns used to
// hold the whole entry row as Prisma returned it, and the row was fetched with
// its project relation - so every version of every entry carried a copy of the
// project's field definitions too. Restoring an old version only needs the
// entry's own fields, so snapshots are trimmed to those five values and the
// bloat stops here.
//
// The shape is the same in both directions: `toEntrySnapshot` when writing an
// audit row, `readEntrySnapshot` when reading one back. The reader tolerates
// both the trimmed shape and the old bloated one, so history works against rows
// written before the trim (and against the backfilled ones).

export interface EntrySnapshot {
  title: string | null;
  body: string | null;
  content: Prisma.JsonValue;
  /** ISO-8601. `Entry.date` is a `Date`; JSON has no date type. */
  date: string;
  /**
   * Absent on snapshots written before tags were captured, and on legacy rows
   * whose `tags` relation was never loaded. Absent means "unknown", which is
   * not the same as "no tags" - a restore leaves tags alone rather than
   * stripping them.
   */
  tagIds?: number[];
}

type SnapshotSource = {
  title?: string | null;
  body?: string | null;
  content?: unknown;
  date?: Date | string | null;
  tags?: { tagId: number }[] | null;
};

export function toEntrySnapshot(entry: SnapshotSource): EntrySnapshot {
  return {
    title: entry.title ?? null,
    body: entry.body ?? null,
    content: (entry.content ?? {}) as Prisma.JsonValue,
    date: toIso(entry.date),
    tagIds: entry.tags?.map((tag) => tag.tagId) ?? [],
  };
}

export function readEntrySnapshot(data: Prisma.JsonValue | null): EntrySnapshot | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;

  const record = data as Record<string, unknown>;
  // Every snapshot shape has carried `content`; its absence means the row is
  // something else entirely, and guessing would write junk onto the entry.
  if (!('content' in record)) return null;

  const snapshot: EntrySnapshot = {
    title: typeof record.title === 'string' ? record.title : null,
    body: typeof record.body === 'string' ? record.body : null,
    content: (record.content ?? {}) as Prisma.JsonValue,
    date: typeof record.date === 'string' ? record.date : new Date().toISOString(),
  };

  if (Array.isArray(record.tagIds)) {
    snapshot.tagIds = record.tagIds.filter((id): id is number => typeof id === 'number');
  }

  return snapshot;
}

/**
 * Prisma's write type for a JSON column (`InputJsonValue`) rules out `null` at
 * the top level, while the read type (`JsonValue`) allows it - so a snapshot in
 * read shape is not directly assignable to `oldData` / `newData`. A snapshot is
 * always an object, so this cast is safe, and it lives here so every write goes
 * through one cast rather than a cast per call site.
 */
export function toAuditData(snapshot: EntrySnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

function toIso(date: Date | string | null | undefined): string {
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') return date;
  return new Date().toISOString();
}
