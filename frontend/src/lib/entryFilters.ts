export type DateRangeKey = 'all' | 'today' | '7d' | '30d' | 'custom';

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};

export type EntryFilters = {
  search: string;
  projectId: number | null;
  dateRange: DateRangeKey;
  customFrom: string; // yyyy-mm-dd, only used when dateRange === 'custom'
  customTo: string;
  tagIds: number[];
};

export const DEFAULT_FILTERS: EntryFilters = {
  search: '',
  projectId: null,
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  tagIds: [],
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
  if (filters.projectId !== null) params.set('projectId', String(filters.projectId));
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
    filters.tagIds.length > 0
  );
}
