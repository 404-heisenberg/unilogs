import { Prisma } from '../generated/prisma/client.js';

export interface EntryListQuery {
  q?: string;
  projectId?: string;
  tagIds?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  limit?: string;
  /** A field of the project in `projectId`, filtered by `value` or `min`/`max`. */
  field?: string;
  value?: string;
  min?: string;
  max?: string;
}

/**
 * A filter on one field's value. It needs the field's type to mean anything,
 * so the route resolves it against the project (see entryFieldFilter.ts).
 */
export interface FieldFilter {
  projectId: number;
  name: string;
  value?: string;
  min?: string;
  max?: string;
}

export interface ParsedEntryQuery {
  where: Prisma.EntryWhereInput;
  /** Applied on top of `where` by the route, once the field's type is known. */
  fieldFilter?: FieldFilter;
  /** The trimmed `q`, which the route also matches against field values. */
  searchTerm?: string;
  skip: number;
  take: number;
  page: number;
  limit: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parseEntryListQuery(
  query: EntryListQuery,
  userId: string,
): ParsedEntryQuery | { error: string } {
  const rawPage = parseInt(query.page ?? '1', 10);
  if (Number.isNaN(rawPage) || rawPage < 1) {
    return { error: 'page must be a positive integer' };
  }
  const page = rawPage;

  const rawLimit = query.limit ? parseInt(query.limit, 10) : DEFAULT_LIMIT;
  if (Number.isNaN(rawLimit) || rawLimit < 1) {
    return { error: 'limit must be a positive integer' };
  }
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const and: Prisma.EntryWhereInput[] = [];

  let projectId: number | undefined;
  if (query.projectId) {
    const pid = parseInt(query.projectId, 10);
    if (Number.isNaN(pid)) return { error: 'projectId must be a valid integer' };
    projectId = pid;
    and.push({ projectId: pid });
  }

  let fieldFilter: FieldFilter | undefined;
  const fieldName = query.field?.trim();
  if (fieldName) {
    // Field names belong to a project, so a field filter only makes sense
    // inside one.
    if (projectId === undefined) return { error: 'field requires projectId' };
    const value = query.value?.trim() || undefined;
    const min = query.min?.trim() || undefined;
    const max = query.max?.trim() || undefined;
    if (value === undefined && min === undefined && max === undefined) {
      return { error: 'field needs a value, min or max' };
    }
    fieldFilter = { projectId, name: fieldName, value, min, max };
  } else if (query.value || query.min || query.max) {
    return { error: 'value, min and max need a field' };
  }

  if (query.tagIds) {
    const tagIds = query.tagIds
      .split(',')
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (tagIds.length === 0) {
      return { error: 'tagIds must be a comma-separated list of integers' };
    }

    for (const tagId of tagIds) {
      and.push({ tags: { some: { tagId } } });
    }
  }

  if (query.dateFrom || query.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      if (Number.isNaN(d.getTime())) return { error: 'dateFrom must be a valid date' };
      dateFilter.gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      if (Number.isNaN(d.getTime())) return { error: 'dateTo must be a valid date' };
      dateFilter.lte = d;
    }
    and.push({ date: dateFilter });
  }
  // The search itself is added by the route (searchWhere), because matching
  // field values needs a query of its own.
  const searchTerm = query.q?.trim();

  const where: Prisma.EntryWhereInput = {
    project: { userId },
    ...(and.length > 0 ? { AND: and } : {}),
  };

  return {
    where,
    skip,
    take: limit,
    page,
    limit,
    ...(fieldFilter ? { fieldFilter } : {}),
    ...(searchTerm ? { searchTerm } : {}),
  };
}

/**
 * `q` matches an entry's title, body, project name, or any of its field
 * values. `contentMatches` is the ids whose field values matched, which
 * Prisma can't search case-insensitively inside JSON.
 */
export function searchWhere(term: string, contentMatches: number[]): Prisma.EntryWhereInput {
  return {
    OR: [
      { title: { contains: term, mode: 'insensitive' } },
      { body: { contains: term, mode: 'insensitive' } },
      { project: { name: { contains: term, mode: 'insensitive' } } },
      ...(contentMatches.length > 0 ? [{ id: { in: contentMatches } }] : []),
    ],
  };
}
