import {
  describeFieldFilter,
  fieldFilterParams,
  isFieldFilterReady,
  type FieldFilter,
} from '@/lib/entryFields';

export type DateRangeKey = 'all' | 'today' | '7d' | '30d' | 'custom';

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};

// Open (unfinished) todo items. Filtered in the browser from
// /api/stats/unfinished, since the entries endpoint has no status filter.
export type EntryStatus = 'unfinished' | 'overdue';

export type UnfinishedGroups = {
  overdue: { entryId: number; dueDate: string | null }[];
  dueThisWeek: { entryId: number; dueDate: string | null }[];
  noDueDate: { entryId: number; dueDate: string | null }[];
};

export function statusEntryIds(
  groups: UnfinishedGroups | undefined,
): Record<EntryStatus, Set<number>> {
  const overdue = new Set((groups?.overdue ?? []).map((item) => item.entryId));
  const unfinished = new Set(
    [...(groups?.overdue ?? []), ...(groups?.dueThisWeek ?? []), ...(groups?.noDueDate ?? [])].map(
      (item) => item.entryId,
    ),
  );
  return { unfinished, overdue };
}

export type EntryFilters = {
  search: string;
  projectId: number | null;
  dateRange: DateRangeKey;
  customFrom: string; // yyyy-mm-dd, only used when dateRange === 'custom'
  customTo: string;
  tagIds: number[];
  status: EntryStatus | null;
  /** One of the chosen project's fields; only applies with a project. */
  field: FieldFilter | null;
};

export const DEFAULT_FILTERS: EntryFilters = {
  search: '',
  projectId: null,
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  tagIds: [],
  status: null,
  field: null,
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Bounds are inclusive on both ends, matching the backend's gte/lte filter.
export function dateBoundsFor(filters: EntryFilters): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (filters.dateRange) {
    case 'today':
      return { dateFrom: startOfDay(now).toISOString() };
    case '7d': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: from.toISOString() };
    }
    case '30d': {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { dateFrom: from.toISOString() };
    }
    case 'custom':
      return {
        dateFrom: filters.customFrom || undefined,
        dateTo: filters.customTo || undefined,
      };
    case 'all':
    default:
      return {};
  }
}

export function buildEntriesQuery(filters: EntryFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('q', filters.search.trim());
  if (filters.projectId !== null) {
    params.set('projectId', String(filters.projectId));
    // Field names belong to a project, so the field filter rides with it.
    for (const [key, value] of Object.entries(fieldFilterParams(filters.field))) {
      params.set(key, value);
    }
  }
  if (filters.tagIds.length > 0) params.set('tagIds', filters.tagIds.join(','));

  const { dateFrom, dateTo } = dateBoundsFor(filters);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  params.set('limit', '100');

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function isFiltering(filters: EntryFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.projectId !== null ||
    filters.dateRange !== 'all' ||
    filters.tagIds.length > 0 ||
    filters.status !== null ||
    (filters.projectId !== null && isFieldFilterReady(filters.field))
  );
}

/**
 * The active filters in words, for filterSummary: every one of them must
 * hold, which is what the API does with them.
 */
export function describeFilters(
  filters: EntryFilters,
  names: { project: (id: number) => string | undefined; tag: (id: number) => string | undefined },
): string[] {
  const parts: string[] = [];
  if (filters.projectId !== null) {
    parts.push(`in ${names.project(filters.projectId) ?? 'the chosen project'}`);
    if (isFieldFilterReady(filters.field)) parts.push(describeFieldFilter(filters.field));
  }
  const search = filters.search.trim();
  if (search) parts.push(`mention “${search}”`);
  if (filters.tagIds.length > 0) {
    const tags = filters.tagIds.map((id) => names.tag(id) ?? 'a tag');
    parts.push(`tagged ${tags.join(' and ')}`);
  }
  if (filters.dateRange === 'custom') {
    if (filters.customFrom && filters.customTo) {
      parts.push(`dated ${filters.customFrom} to ${filters.customTo}`);
    } else if (filters.customFrom) parts.push(`dated from ${filters.customFrom}`);
    else if (filters.customTo) parts.push(`dated up to ${filters.customTo}`);
  } else if (filters.dateRange !== 'all') {
    parts.push(`from ${DATE_RANGE_LABELS[filters.dateRange].toLowerCase()}`);
  }
  if (filters.status) parts.push(filters.status === 'overdue' ? 'overdue' : 'unfinished');
  return parts;
}
