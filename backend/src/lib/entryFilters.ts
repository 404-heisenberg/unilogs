import { Prisma } from '../generated/prisma/client.js';

export interface EntryListQuery {
  q?: string;
  projectId?: string;
  tagIds?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  limit?: string;
}

export interface ParsedEntryQuery {
  where: Prisma.EntryWhereInput;
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

  if (query.projectId) {
    const pid = parseInt(query.projectId, 10);
    if (Number.isNaN(pid)) return { error: 'projectId must be a valid integer' };
    and.push({ projectId: pid });
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
  const searchTerm = query.q?.trim();
  if (searchTerm) {
    and.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { body: { contains: searchTerm, mode: 'insensitive' } },
        { project: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  const where: Prisma.EntryWhereInput = {
    project: { userId },
    ...(and.length > 0 ? { AND: and } : {}),
  };

  return { where, skip, take: limit, page, limit };
}
