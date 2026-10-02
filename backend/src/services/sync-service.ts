import { Prisma, type FieldDefinition } from '../generated/prisma/client.js';
import { prisma, prismaWithDeleted } from '../lib/prisma.js';
import { toAuditData, toEntrySnapshot } from '../lib/audit-snapshot.js';
import { validateEntryContent, isWhollyEmpty } from '../lib/validateEntry.js';

/**
 * A batch from the offline queue. One bad entry must not fail the batch, so
 * every field here is treated as untrusted: the sync endpoint is the only
 * place that accepts a shape no UI can produce.
 */
export type QueuedEntry = {
  clientId?: unknown;
  projectId?: unknown;
  content?: unknown;
  date?: unknown;
  title?: unknown;
  body?: unknown;
  tagIds?: unknown;
};

export type SyncStatus = 'created' | 'duplicate' | 'failed';

export type SyncEntryResult = {
  clientId: string;
  status: SyncStatus;
  /** Set for `created` and `duplicate`, so the client can drop the queue item. */
  entryId?: number;
  /** Why it failed, or why a duplicate was not a plain match. */
  reason?: string;
};

/** A queued entry after its shape has been checked. */
type ValidatedEntry = {
  clientId: string;
  projectId: number;
  content: Record<string, unknown>;
  date: Date;
  title: string | null;
  body: string | null;
  tagIds: number[];
};

// A client id is a UUID or similar opaque string. This is not a security
// boundary - the unique index is - but an unbounded string in a query result
// set is worth refusing early.
const MAX_CLIENT_ID_LENGTH = 191;

export const MAX_SYNC_BATCH_SIZE = 100;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the shape the client is expected to send, without trusting it. */
function parseEntry(raw: QueuedEntry): { entry: ValidatedEntry } | { reason: string } {
  if (typeof raw.clientId !== 'string' || raw.clientId.trim() === '') {
    return { reason: 'clientId is required and must be a non-empty string' };
  }
  const clientId = raw.clientId.trim();
  if (clientId.length > MAX_CLIENT_ID_LENGTH) {
    return { reason: `clientId must be at most ${MAX_CLIENT_ID_LENGTH} characters` };
  }

  const projectId = typeof raw.projectId === 'number' ? raw.projectId : Number(raw.projectId);
  if (!Number.isInteger(projectId)) {
    return { reason: 'projectId must be an integer' };
  }

  if (!isPlainObject(raw.content)) {
    return { reason: 'content must be an object of field values' };
  }

  // No date means "now", matching `POST /api/entries`. An unparseable one is a
  // client bug: silently substituting today would log an entry under the wrong
  // day, so it is reported instead.
  let date = new Date();
  if (raw.date !== undefined && raw.date !== null) {
    if (typeof raw.date !== 'string' && typeof raw.date !== 'number') {
      return { reason: 'date must be an ISO date string' };
    }
    date = new Date(raw.date);
    if (Number.isNaN(date.getTime())) {
      return { reason: 'date is not a valid date' };
    }
  }

  if (raw.title !== undefined && raw.title !== null && typeof raw.title !== 'string') {
    return { reason: 'title must be a string' };
  }
  if (raw.body !== undefined && raw.body !== null && typeof raw.body !== 'string') {
    return { reason: 'body must be a string' };
  }

  let tagIds: number[] = [];
  if (raw.tagIds !== undefined && raw.tagIds !== null) {
    if (!Array.isArray(raw.tagIds) || raw.tagIds.some((id) => !Number.isInteger(id))) {
      return { reason: 'tagIds must be an array of integers' };
    }
    tagIds = raw.tagIds as number[];
  }

  return {
    entry: {
      clientId,
      projectId,
      content: raw.content,
      date,
      title: (raw.title as string | null | undefined) ?? null,
      body: (raw.body as string | null | undefined) ?? null,
      tagIds,
    },
  };
}

/**
 * Syncs a queue of offline entries.
 *
 * Idempotency comes from the unique index on `Entry.clientId`, not from the
 * check below: the lookup narrows the common case, and the constraint is what
 * makes two concurrent syncs of the same batch safe. Losing that race surfaces
 * as `duplicate`, not a failure.
 *
 * Soft-deleted rows count as present. An entry the user deleted is not
 * resurrected by a stale copy still sitting in the queue, which is why the
 * duplicate lookup reads through `prismaWithDeleted`.
 */
export async function syncEntries(
  userId: string,
  rawEntries: QueuedEntry[],
): Promise<SyncEntryResult[]> {
  // Ownership is checked per project and per tag rather than per entry: a queue
  // usually targets a handful of projects, so two queries replace two per entry.
  const wantedProjectIds = [
    ...new Set(
      rawEntries
        .map((raw) => (typeof raw?.projectId === 'number' ? raw.projectId : Number(raw?.projectId)))
        .filter((id) => Number.isInteger(id)),
    ),
  ];
  const wantedTagIds = [
    ...new Set(
      rawEntries.flatMap((raw) =>
        Array.isArray(raw?.tagIds)
          ? raw.tagIds.filter((id): id is number => Number.isInteger(id))
          : [],
      ),
    ),
  ];

  const [projects, ownedTags] = await Promise.all([
    wantedProjectIds.length === 0
      ? Promise.resolve([])
      : prisma.project.findMany({
          where: { id: { in: wantedProjectIds }, userId },
          select: { id: true, fields: true },
        }),
    wantedTagIds.length === 0
      ? Promise.resolve([])
      : prisma.tag.findMany({
          where: { id: { in: wantedTagIds }, userId },
          select: { id: true },
        }),
  ]);

  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const ownedTagIds = new Set(ownedTags.map((tag) => tag.id));

  const results: SyncEntryResult[] = [];

  for (const raw of rawEntries) {
    const parsed = parseEntry(raw);

    if ('reason' in parsed) {
      results.push({
        clientId: typeof raw?.clientId === 'string' ? raw.clientId : '',
        status: 'failed',
        reason: parsed.reason,
      });
      continue;
    }

    const entry = parsed.entry;
    const result = await syncOneEntry(entry, projectsById, ownedTagIds);
    results.push(result);
  }

  return results;
}

async function syncOneEntry(
  entry: ValidatedEntry,
  projectsById: Map<number, { id: number; fields: FieldDefinition[] }>,
  ownedTagIds: Set<number>,
): Promise<SyncEntryResult> {
  const existing = await prismaWithDeleted.entry.findUnique({
    where: { clientId: entry.clientId },
    select: { id: true, deletedAt: true },
  });

  if (existing) {
    return {
      clientId: entry.clientId,
      status: 'duplicate',
      entryId: existing.id,
      ...(existing.deletedAt
        ? { reason: 'An entry with this clientId was deleted, so the queued copy was not restored' }
        : {}),
    };
  }

  const project = projectsById.get(entry.projectId);
  if (!project) {
    return {
      clientId: entry.clientId,
      status: 'failed',
      reason: 'You do not have access to this project',
    };
  }

  const missingTags = entry.tagIds.filter((tagId) => !ownedTagIds.has(tagId));
  if (missingTags.length > 0) {
    return {
      clientId: entry.clientId,
      status: 'failed',
      reason: 'One or more tags do not belong to you',
    };
  }

  const contentErrors = validateEntryContent(entry.content, project.fields);
  if (contentErrors.length > 0) {
    return { clientId: entry.clientId, status: 'failed', reason: contentErrors.join('; ') };
  }

  if (isWhollyEmpty(entry.title, entry.body, entry.content)) {
    return {
      clientId: entry.clientId,
      status: 'failed',
      reason: 'Entry must have a title, body, or at least one field value',
    };
  }

  try {
    // Entry and audit row together: an entry with no CREATE audit row would be
    // invisible to version history, which is worse than not syncing it at all.
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.entry.create({
        data: {
          clientId: entry.clientId,
          projectId: entry.projectId,
          content: entry.content as Prisma.InputJsonValue,
          date: entry.date,
          title: entry.title,
          body: entry.body,
          tags: entry.tagIds.length
            ? { create: entry.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
            : undefined,
        },
        include: { tags: true },
      });

      await tx.auditLog.create({
        data: {
          entryId: row.id,
          action: 'CREATE',
          newData: toAuditData(toEntrySnapshot(row)),
        },
      });

      return row;
    });

    return { clientId: entry.clientId, status: 'created', entryId: created.id };
  } catch (error) {
    // Two syncs of the same batch raced, and the unique index settled it. The
    // loser's entry already exists, so from the client's point of view this is
    // the same outcome as the duplicate check finding it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prismaWithDeleted.entry.findUnique({
        where: { clientId: entry.clientId },
        select: { id: true },
      });
      return {
        clientId: entry.clientId,
        status: 'duplicate',
        ...(winner ? { entryId: winner.id } : {}),
      };
    }

    console.error('POST /api/entries/sync failed for', entry.clientId, error);
    return {
      clientId: entry.clientId,
      status: 'failed',
      reason: 'Entry could not be saved',
    };
  }
}
