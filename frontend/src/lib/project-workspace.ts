import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import type { Entry, FieldDefinition, PagedEntries, Project } from '@/types';

export type TabId = 'overview' | 'entries' | 'fields';

export const TAB_IDS: TabId[] = ['overview', 'entries', 'fields'];

export function parseTab(value: string | null): TabId {
  return TAB_IDS.find((id) => id === value) ?? 'overview';
}

export type AggregationKind = 'sum' | 'average' | 'max' | 'min';

export const AGGREGATIONS: { kind: AggregationKind; label: string }[] = [
  { kind: 'sum', label: 'Sum' },
  { kind: 'average', label: 'Average' },
  { kind: 'max', label: 'Max' },
  { kind: 'min', label: 'Min' },
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  duration: 'Duration',
  boolean: 'Toggle',
};

export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}

export type ProjectSummary = {
  projectId: number;
  name: string;
  entryCount: number;
  trackedTimeMinutes: number | null;
  lastLoggedAt: string | null;
  entriesThisWeek: number;
};

export type UnfinishedItem = {
  entryId: number;
  fieldName: string;
  label: string;
  projectName: string;
  dueDate: string | null;
};

export type UnfinishedStats = {
  overdue: UnfinishedItem[];
  dueThisWeek: UnfinishedItem[];
  noDueDate: UnfinishedItem[];
};

export type FieldInsight = {
  fieldId: number;
  name: string;
  fieldType: FieldType;
  value: string | null;
  sub: string;
  trend: 'up' | 'down' | null;
};

export type WeekBar = { weekStart: string; count: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDayKey(date);
}

export function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function formatMonthDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatShortDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return formatMonthDay(day);
}

export function relativeDay(diff: number): string {
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function formatDurationHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function entryTitle(entry: Entry): string {
  const title = entry.title?.trim();
  if (title) return title;
  const firstText = Object.values(entry.content).find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return firstText?.trim() ?? 'Untitled entry';
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
  });
}

export function entryDurationHours(entry: Entry, fields: FieldDefinition[]): number | null {
  let total = 0;
  let found = false;
  for (const field of fields) {
    if (field.fieldType !== 'duration') continue;
    const value = entry.content[field.name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value;
      found = true;
    }
  }
  return found ? total : null;
}

export type BackendFieldInsight = {
  name: string;
  fieldType: string;
  family: string;
  value?: unknown;
  valueMinutes?: number;
  trend: { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null };
  sampleCount: number;
  hasData?: boolean;
};

export type FieldStatsResponse = { projectId: number; fields: BackendFieldInsight[] };

function entryWord(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

function mapTrend(direction: 'up' | 'down' | 'flat' | null): 'up' | 'down' | null {
  return direction === 'up' ? 'up' : direction === 'down' ? 'down' : null;
}

export function mapFieldInsights(
  fields: FieldDefinition[],
  backend: BackendFieldInsight[],
  today: string,
): FieldInsight[] {
  const byName = new Map(backend.map((insight) => [insight.name, insight]));

  return fields.map((field) => {
    const fieldType = isFieldType(field.fieldType) ? field.fieldType : 'text';
    const insight = byName.get(field.name);
    const base = { fieldId: field.id, name: field.name, fieldType };

    if (!insight || insight.hasData === false) {
      return { ...base, value: null, sub: '', trend: null };
    }

    const trend = mapTrend(insight.trend.direction);

    if (fieldType === 'duration') {
      const hours = (insight.valueMinutes ?? 0) / 60;
      return {
        ...base,
        value: formatDurationHours(hours),
        sub: entryWord(insight.sampleCount),
        trend,
      };
    }

    if (fieldType === 'number') {
      if (insight.family === 'number') {
        const { average, total } = insight.value as { average: number; total: number };
        return {
          ...base,
          value: formatNumber(total),
          sub: `avg ${formatNumber(average)} per entry`,
          trend,
        };
      }
      const value = insight.value as number;
      const sub =
        insight.family === 'average'
          ? entryWord(insight.sampleCount)
          : entryWord(insight.sampleCount);
      return { ...base, value: formatNumber(value), sub, trend };
    }

    if (fieldType === 'boolean') {
      const { pctTrue } = insight.value as { pctTrue: number };
      const trueCount = Math.round((pctTrue / 100) * insight.sampleCount);
      return {
        ...base,
        value: `${Math.round(pctTrue)}%`,
        sub: `${trueCount} of ${entryWord(insight.sampleCount)}`,
        trend,
      };
    }

    if (fieldType === 'date') {
      const { mostRecent } = insight.value as { mostRecent: string };
      const day = mostRecent.slice(0, 10);
      return {
        ...base,
        value: formatShortDate(day),
        sub: relativeDay(daysBetween(today, day)),
        trend: null,
      };
    }

    const { top } = insight.value as { top: { value: string; count: number }[] };
    const first = top[0];
    const value =
      top.length > 1 && first.count > 1 ? `Mostly ${first.value}` : (first?.value ?? '');
    return { ...base, value, sub: entryWord(insight.sampleCount), trend };
  });
}

export function weeklyActivity(entries: Entry[], today: string, weeks = 8): WeekBar[] {
  const current = mondayOf(today);
  const bars: WeekBar[] = Array.from({ length: weeks }, (_, index) => ({
    weekStart: addDays(current, -(weeks - 1 - index) * 7),
    count: 0,
  }));
  const positions = new Map(bars.map((bar, index) => [bar.weekStart, index]));
  for (const entry of entries) {
    const position = positions.get(mondayOf(entry.date.slice(0, 10)));
    if (position !== undefined) bars[position].count += 1;
  }
  return bars;
}

export function renameEntryKeys(entries: Entry[], from: string, to: string): Entry[] {
  return entries.map((entry) => {
    if (!Object.prototype.hasOwnProperty.call(entry.content, from)) return entry;
    const content: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry.content)) {
      content[key === from ? to : key] = value;
    }
    return { ...entry, content };
  });
}

export function withoutItem(stats: UnfinishedStats, item: UnfinishedItem): UnfinishedStats {
  const keep = (other: UnfinishedItem) =>
    !(other.entryId === item.entryId && other.fieldName === item.fieldName);
  return {
    overdue: stats.overdue.filter(keep),
    dueThisWeek: stats.dueThisWeek.filter(keep),
    noDueDate: stats.noDueDate.filter(keep),
  };
}

const PAGE_SIZE = 100;

function entriesUrl(projectId: string, page: number): string {
  return `/api/entries?projectId=${projectId}&limit=${PAGE_SIZE}&page=${page}`;
}

export async function loadProjectEntries(projectId: string): Promise<Entry[]> {
  const first = await api.get<PagedEntries>(entriesUrl(projectId, 1));
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      api.get<PagedEntries>(entriesUrl(projectId, index + 2)),
    ),
  );
  return [first, ...rest].flatMap((page) => page.entries);
}

export function useProjectWorkspace(projectId: string) {
  const enabled = Number.isInteger(Number(projectId)) && Number(projectId) > 0;

  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled,
  });

  const fields = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled,
  });

  const entries = useQuery({
    queryKey: ['project-entries', projectId],
    queryFn: () => loadProjectEntries(projectId),
    enabled,
  });

  const summary = useQuery({
    queryKey: ['project-summary', projectId],
    queryFn: () => api.get<ProjectSummary>(`/api/projects/${projectId}/summary`),
    enabled,
    retry: false,
  });

  const insights = useQuery({
    queryKey: ['project-field-stats', projectId],
    queryFn: () => api.get<FieldStatsResponse>(`/api/stats/fields/${projectId}`),
    enabled,
  });

  const projectName = project.data?.name;
  const unfinished = useQuery({
    queryKey: ['unfinished', projectId],
    queryFn: async () => {
      const all = await api.get<UnfinishedStats>('/api/stats/unfinished');
      const belongsHere = (item: UnfinishedItem) => item.projectName === projectName;
      return {
        overdue: all.overdue.filter(belongsHere),
        dueThisWeek: all.dueThisWeek.filter(belongsHere),
        noDueDate: all.noDueDate.filter(belongsHere),
      };
    },
    enabled: enabled && !!projectName,
    retry: false,
  });

  return { project, fields, entries, summary, insights, unfinished };
}

export type FieldActions = {
  create: (input: { name: string; fieldType: FieldType }) => void;
  update: (input: {
    id: number;
    previousName: string;
    name?: string;
    fieldType?: FieldType;
    aggregationOverride?: AggregationKind | null;
  }) => void;
  remove: (id: number) => void;
  creating: boolean;
  createError: string | null;
  updateError: string | null;
  deletingId: number | null;
};

export type ProjectActions = {
  save: (input: { name: string; description: string }, onDone: () => void) => void;
  toggleArchive: (archived: boolean) => void;
  saving: boolean;
  archiving: boolean;
  error: string | null;
};

export function useProjectMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidateEntries = () => {
    queryClient.invalidateQueries({ queryKey: ['project-entries', projectId] });
    queryClient.invalidateQueries({ queryKey: ['entries'] });
    queryClient.invalidateQueries({ queryKey: ['entry'] });
  };
  const invalidateFields = () =>
    queryClient.invalidateQueries({ queryKey: ['field-definitions', projectId] });
  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const createField = useMutation({
    mutationFn: (input: { name: string; fieldType: FieldType }) =>
      api.post<FieldDefinition>('/api/field-definitions', {
        projectId: Number(projectId),
        ...input,
      }),
    onSuccess: invalidateFields,
  });

  const updateField = useMutation({
    mutationFn: (input: {
      id: number;
      previousName: string;
      name?: string;
      fieldType?: FieldType;
      aggregationOverride?: AggregationKind | null;
    }) =>
      api.put<FieldDefinition>(`/api/field-definitions/${input.id}`, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
        ...(input.aggregationOverride !== undefined
          ? { aggregationOverride: input.aggregationOverride }
          : {}),
      }),
    onSuccess: (_field, input) => {
      if (input.name !== undefined && input.name !== input.previousName) {
        const newName = input.name;
        queryClient.setQueryData<Entry[]>(['project-entries', projectId], (old) =>
          old ? renameEntryKeys(old, input.previousName, newName) : old,
        );
      }
      invalidateFields();
      invalidateEntries();
      queryClient.invalidateQueries({ queryKey: ['project-field-stats', projectId] });
    },
  });

  const deleteField = useMutation({
    mutationFn: (id: number) => api.delete(`/api/field-definitions/${id}`),
    onSuccess: invalidateFields,
  });

  const saveProject = useMutation({
    mutationFn: (input: { name: string; description: string }) =>
      api.patch<Project>(`/api/projects/${projectId}`, input),
    onSuccess: invalidateProject,
  });

  const archiveProject = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<Project>(`/api/projects/${projectId}/${archived ? 'unarchive' : 'archive'}`),
    onSuccess: invalidateProject,
  });

  const markDone = useMutation({
    mutationFn: async (item: UnfinishedItem) => {
      const entry = await api.get<Entry>(`/api/entries/${item.entryId}`);
      await api.put<Entry>(`/api/entries/${item.entryId}`, {
        content: { ...entry.content, [item.fieldName]: true },
      });
    },
    onMutate: async (item) => {
      const key = ['unfinished', projectId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UnfinishedStats>(key);
      queryClient.setQueryData<UnfinishedStats>(key, (old) => (old ? withoutItem(old, item) : old));
      return { previous };
    },
    onError: (_error, _item, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['unfinished', projectId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['unfinished', projectId] });
      invalidateEntries();
    },
  });

  const fieldActions: FieldActions = {
    create: createField.mutate,
    update: updateField.mutate,
    remove: deleteField.mutate,
    creating: createField.isPending,
    createError: createField.error?.message ?? null,
    updateError: updateField.error?.message ?? null,
    deletingId: deleteField.isPending ? (deleteField.variables ?? null) : null,
  };

  const projectActions: ProjectActions = {
    save: (input, onDone) => saveProject.mutate(input, { onSuccess: onDone }),
    toggleArchive: (archived) => archiveProject.mutate(archived),
    saving: saveProject.isPending,
    archiving: archiveProject.isPending,
    error: saveProject.error?.message ?? archiveProject.error?.message ?? null,
  };

  return {
    fieldActions,
    projectActions,
    markDone: markDone.mutate,
    markFailed: markDone.isError,
  };
}
