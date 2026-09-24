import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  getFrequencyStats,
  getStatsSummary,
  type CalendarSuggestionsResponse,
  type FrequencyStats,
  type StatsSummary,
} from '@/lib/api';

import type { Entry, FieldDefinition, PagedEntries } from '@/types';

export type DailyCount = { date: string; count: number };

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type HeatCell = {
  date: string;
  count: number;
  level: HeatLevel;
  future: boolean;
};

export type ActivityStats = {
  activeDays: number;
  daysThisWeek: number;
  avgDaysPerWeek: number;
};

export const HEATMAP_WEEKS = 12;
export const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

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

export function heatmapRange(today: string): { start: string; end: string } {
  const currentWeek = mondayOf(today);
  return {
    start: addDays(currentWeek, -(HEATMAP_WEEKS - 1) * 7),
    end: addDays(currentWeek, 6),
  };
}

export function heatLevel(count: number, max: number): HeatLevel {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((count / max) * 4)) as HeatLevel;
}

function streakDays(counts: Map<string, number>, streak: number, today: string): Set<string> {
  const days = new Set<string>();
  if (streak <= 0) return days;
  const end = (counts.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  for (let i = 0; i < streak; i += 1) days.add(addDays(end, -i));
  return days;
}

export function buildHeatmap(daily: DailyCount[], streak: number, today: string): HeatCell[] {
  const counts = new Map(daily.map((entry) => [entry.date, entry.count]));
  const max = Math.max(0, ...counts.values());
  const streakSet = streakDays(counts, streak, today);
  const { start } = heatmapRange(today);

  return Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = addDays(start, index);
    const count = counts.get(date) ?? 0;
    const future = date > today;
    let level: HeatLevel = heatLevel(count, max);
    if (streakSet.has(date) && count > 0) level = 4;
    if (future) level = 0;
    return { date, count, level, future };
  });
}

export function activityStats(cells: HeatCell[]): ActivityStats {
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const daysThisWeek = cells.slice(-7).filter((cell) => cell.count > 0).length;
  return {
    activeDays,
    daysThisWeek,
    avgDaysPerWeek: Math.round(activeDays / HEATMAP_WEEKS),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parts(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return { d: date.getUTCDate(), m: date.getUTCMonth(), w: date.getUTCDay() };
}

export function formatShortDate(day: string): string {
  const { d, m } = parts(day);
  return `${d} ${MONTHS[m]}`;
}

export function formatMonthDay(day: string): string {
  const { d, m } = parts(day);
  return `${MONTHS[m]} ${d}`;
}

export function formatDayLabel(day: string): string {
  const { d, m, w } = parts(day);
  return `${WEEKDAYS[w]} ${d} ${MONTHS[m]}`;
}

export function formatLongDate(day: string): string {
  const { d, m, w } = parts(day);
  return `${LONG_WEEKDAYS[w]}, ${d} ${LONG_MONTHS[m]}`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function entryTitle(entry: Entry): string {
  const title = entry.title?.trim();
  if (title) return title;
  const firstText = Object.values(entry.content).find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return firstText?.trim() ?? 'Untitled entry';
}

export function entryDateLabel(entry: Entry, today: string): string {
  const day = entry.date.slice(0, 10);
  if (day === today) {
    const time = new Date(entry.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `Today ${time}`;
  }
  if (day === addDays(today, -1)) return 'Yesterday';
  return formatMonthDay(day);
}

export type WidgetId =
  | 'summary'
  | 'heatmap'
  | 'whatsLeft'
  | 'recent'
  | 'continue'
  | 'upcoming'
  | 'insight'
  | 'timeByProject'
  | 'frequency'
  | 'dueDormant';

export type WidgetSize = 'standard' | 'wide';

export type WidgetState = {
  id: WidgetId;
  visible: boolean;
  size: WidgetSize;
};

export type ThumbnailKind = 'stat' | 'donut' | 'bars' | 'list' | 'card';

export type WidgetMeta = {
  title: string;
  available: boolean;
  thumbnail: ThumbnailKind;
};

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  summary: { title: 'Summary', available: true, thumbnail: 'stat' },
  heatmap: { title: 'Activity', available: true, thumbnail: 'stat' },
  whatsLeft: { title: "What's left", available: true, thumbnail: 'list' },
  recent: { title: 'Recent entries', available: true, thumbnail: 'list' },
  continue: { title: 'Continue logging', available: true, thumbnail: 'card' },
  upcoming: { title: 'Upcoming', available: true, thumbnail: 'list' },
  insight: { title: 'Insight', available: true, thumbnail: 'card' },
  timeByProject: { title: 'Time by project', available: true, thumbnail: 'donut' },
  frequency: { title: 'Logging frequency', available: true, thumbnail: 'bars' },
  dueDormant: { title: 'Due & dormant', available: true, thumbnail: 'list' },
};

const WIDGET_IDS = Object.keys(WIDGET_META) as WidgetId[];

// Order matches the Figma mobile dashboard frame's single-column sequence:
// summary, activity, what's left, continue logging, recent entries, insight,
// upcoming. Desktop reflows this same order into two columns (see toBlocks).
export const DEFAULT_LAYOUT: WidgetState[] = [
  { id: 'summary', visible: true, size: 'wide' },
  { id: 'heatmap', visible: true, size: 'wide' },
  { id: 'whatsLeft', visible: true, size: 'standard' },
  { id: 'continue', visible: true, size: 'standard' },
  { id: 'recent', visible: true, size: 'standard' },
  { id: 'insight', visible: true, size: 'standard' },
  { id: 'upcoming', visible: true, size: 'standard' },
  { id: 'timeByProject', visible: false, size: 'standard' },
  { id: 'frequency', visible: false, size: 'standard' },
  { id: 'dueDormant', visible: false, size: 'standard' },
];

export function layoutKey(userId: string): string {
  return `unilogs:dashboard-layout:${userId}`;
}

function isWidgetState(value: unknown): value is WidgetState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    WIDGET_IDS.includes(candidate.id as WidgetId) &&
    typeof candidate.visible === 'boolean' &&
    (candidate.size === 'standard' || candidate.size === 'wide')
  );
}

export function loadLayout(userId: string | null): WidgetState[] {
  if (!userId) return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(layoutKey(userId));
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    const seen = new Set<WidgetId>();
    const kept: WidgetState[] = [];
    for (const item of parsed) {
      if (isWidgetState(item) && !seen.has(item.id)) {
        seen.add(item.id);
        kept.push({ id: item.id, visible: item.visible, size: item.size });
      }
    }
    const missing = DEFAULT_LAYOUT.filter((widget) => !seen.has(widget.id));
    return [...kept, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(userId: string, layout: WidgetState[]): void {
  try {
    if (layout === DEFAULT_LAYOUT) {
      localStorage.removeItem(layoutKey(userId));
    } else {
      localStorage.setItem(layoutKey(userId), JSON.stringify(layout));
    }
  } catch {
    return;
  }
}

export function moveWidget(layout: WidgetState[], activeId: WidgetId, overId: WidgetId) {
  const from = layout.findIndex((widget) => widget.id === activeId);
  const to = layout.findIndex((widget) => widget.id === overId);
  if (from < 0 || to < 0 || from === to) return layout;
  const next = [...layout];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function shiftWidget(layout: WidgetState[], id: WidgetId, delta: -1 | 1) {
  const shown = layout.filter((widget) => widget.visible && WIDGET_META[widget.id].available);
  const index = shown.findIndex((widget) => widget.id === id);
  const target = shown[index + delta];
  if (index < 0 || !target) return layout;
  return moveWidget(layout, id, target.id);
}

export type GridBlock =
  | { kind: 'row'; widget: WidgetState }
  | { kind: 'columns'; left: WidgetState[]; right: WidgetState[] };

export function toBlocks(widgets: WidgetState[], twoColumns: boolean): GridBlock[] {
  if (!twoColumns) return widgets.map((widget) => ({ kind: 'row', widget }));

  const blocks: GridBlock[] = [];
  let run: WidgetState[] = [];

  const flush = () => {
    if (run.length === 0) return;
    blocks.push({
      kind: 'columns',
      left: run.filter((_, index) => index % 2 === 0),
      right: run.filter((_, index) => index % 2 === 1),
    });
    run = [];
  };

  for (const widget of widgets) {
    if (widget.size === 'wide') {
      flush();
      blocks.push({ kind: 'row', widget });
    } else {
      run.push(widget);
    }
  }
  flush();
  return blocks;
}

export type ActivityData = {
  daily: DailyCount[];
  lastLogged: Record<number, string>;
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

export type InsightStat = {
  projectName: string;
  fieldName: string;
  current: number;
  previous: number;
};

const PAGE_SIZE = 100;
const RECENT_LIMIT = 5;

export const QUERY_KEYS = {
  summary: ['stats-summary'],
  frequency: ['stats-frequency'],
  activity: ['dashboard-activity'],
  recent: ['dashboard-recent'],
  unfinished: ['dashboard-unfinished'],
  insight: ['dashboard-insight'],
  upcoming: ['dashboard-upcoming'],
} as const;

export async function loadSummary(): Promise<StatsSummary> {
  return getStatsSummary();
}

export async function loadFrequency(): Promise<FrequencyStats> {
  return getFrequencyStats();
}

function entriesUrl(range: { start: string; end: string }, page: number): string {
  const params = new URLSearchParams({
    dateFrom: `${range.start}T00:00:00.000Z`,
    dateTo: `${range.end}T23:59:59.999Z`,
    limit: String(PAGE_SIZE),
    page: String(page),
  });
  return `/api/entries?${params.toString()}`;
}

export function summariseActivity(entries: Entry[]): ActivityData {
  const counts = new Map<string, number>();
  const lastLogged: Record<number, string> = {};
  for (const entry of entries) {
    const day = entry.date.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
    const previous = lastLogged[entry.projectId];
    if (!previous || day > previous) lastLogged[entry.projectId] = day;
  }
  return {
    daily: Array.from(counts, ([date, count]) => ({ date, count })),
    lastLogged,
  };
}

export async function loadActivity(today: string): Promise<ActivityData> {
  const range = heatmapRange(today);
  const first = await api.get<PagedEntries>(entriesUrl(range, 1));
  const pageCount = Math.ceil(first.total / PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      api.get<PagedEntries>(entriesUrl(range, index + 2)),
    ),
  );
  return summariseActivity([first, ...rest].flatMap((page) => page.entries));
}

export async function loadRecentEntries(): Promise<Entry[]> {
  const page = await api.get<PagedEntries>(`/api/entries?limit=${RECENT_LIMIT}`);
  return page.entries;
}

export async function loadFieldDefinitions(projectId: number): Promise<FieldDefinition[]> {
  return api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`);
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

export function formatDurationHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

export type EntryDurations = Record<number, number | null>;

export function buildDurations(
  entries: Entry[],
  projectIds: number[],
  fieldData: (FieldDefinition[] | undefined)[],
): EntryDurations {
  const byProject = new Map<number, FieldDefinition[]>();
  projectIds.forEach((projectId, index) => {
    const fields = fieldData[index];
    if (fields) byProject.set(projectId, fields);
  });
  const durations: EntryDurations = {};
  for (const entry of entries) {
    const fields = byProject.get(entry.projectId);
    if (fields) durations[entry.id] = entryDurationHours(entry, fields);
  }
  return durations;
}

const combineFieldData = (results: { data: FieldDefinition[] | undefined }[]) =>
  results.map((result) => result.data);

export async function loadUnfinished(): Promise<UnfinishedStats> {
  return api.get<UnfinishedStats>('/api/stats/unfinished');
}

export async function loadInsight(): Promise<InsightStat | null> {
  return null;
}

export type UpcomingEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  description: string | null;
  projectId: number | null;
};

export type UpcomingData = { connected: boolean; events: UpcomingEvent[] };

const UPCOMING_LIMIT = 5;

export async function loadUpcoming(): Promise<UpcomingData> {
  const response = await api.get<CalendarSuggestionsResponse>('/api/calendar/events/suggestions');
  if (!response.connected) return { connected: false, events: [] };

  const now = Date.now();
  const events = response.suggestions
    .map((suggestion) => ({
      id: suggestion.id,
      title: suggestion.title,
      start: suggestion.start ?? null,
      end: suggestion.end ?? null,
      description: suggestion.description?.trim() || null,
      projectId: suggestion.projectId ?? null,
    }))
    .filter((event) => event.start === null || new Date(event.start).getTime() >= now)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    .slice(0, UPCOMING_LIMIT);

  return { connected: true, events };
}

export function formatEventTime(start: string | null): string {
  if (!start) return '';
  if (!start.includes('T')) return formatShortDate(start);
  return new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatEventWhen(event: UpcomingEvent, today: string): string {
  const { start, end } = event;
  if (!start) return '';
  const day = start.slice(0, 10);
  const label =
    day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : formatShortDate(day);
  if (!start.includes('T')) return `${label} · All day`;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const range = end && end.includes('T') ? `${time(start)} – ${time(end)}` : time(start);
  return `${label} · ${range}`;
}

// Opens the entry editor pre-filled from a calendar event. projectId is only
// sent when the suggestion carries one; otherwise the editor falls back to the
// last-used project.
export function logEventPath(event: UpcomingEvent): string {
  const params = new URLSearchParams({ title: event.title });
  if (event.start) params.set('date', event.start.slice(0, 10));
  if (event.projectId !== null) params.set('projectId', String(event.projectId));
  return `/entries/new?${params.toString()}`;
}

export async function markEntryFieldDone(entryId: number, fieldName: string): Promise<void> {
  const entry = await api.get<Entry>(`/api/entries/${entryId}`);
  await api.put<Entry>(`/api/entries/${entryId}`, {
    content: { ...entry.content, [fieldName]: true },
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

export type DormantProject = {
  projectId: number;
  projectName: string;
  lastLogged: string | null;
};

export function findDormantProjects(
  projects: StatsSummary['perProject'],
  lastLogged: Record<number, string>,
  today: string,
  thresholdDays: number,
): DormantProject[] {
  return projects
    .map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      lastLogged: lastLogged[project.projectId] ?? null,
    }))
    .filter(
      (project) =>
        project.lastLogged === null || daysBetween(project.lastLogged, today) >= thresholdDays,
    )
    .sort((a, b) => (a.lastLogged ?? '').localeCompare(b.lastLogged ?? ''));
}

export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    const from = valueRef.current;
    if (from === target) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const length = reduced ? 1 : duration;
    let raf = 0;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / length, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      valueRef.current = next;
      setValue(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function useMediaQuery(query: string, fallback = true): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

  return useSyncExternalStore(
    (onChange) => {
      if (!supported) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (supported ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

const SAVE_DELAY_MS = 300;

type Stored = { userId: string | null; layout: WidgetState[] };

export function useDashboardLayout(userId: string | null) {
  const [stored, setStored] = useState<Stored>(() => ({ userId, layout: loadLayout(userId) }));

  let current = stored;
  if (stored.userId !== userId) {
    current = { userId, layout: loadLayout(userId) };
    setStored(current);
  }
  const layout = current.layout;

  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => saveLayout(userId, layout), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, layout]);

  const update = useCallback((change: (previous: WidgetState[]) => WidgetState[]) => {
    setStored((previous) => ({ ...previous, layout: change(previous.layout) }));
  }, []);

  const move = useCallback(
    (activeId: WidgetId, overId: WidgetId) => update((prev) => moveWidget(prev, activeId, overId)),
    [update],
  );

  const moveBy = useCallback(
    (id: WidgetId, delta: -1 | 1) => update((prev) => shiftWidget(prev, id, delta)),
    [update],
  );

  const toggle = useCallback(
    (id: WidgetId) =>
      update((prev) =>
        prev.map((widget) => (widget.id === id ? { ...widget, visible: !widget.visible } : widget)),
      ),
    [update],
  );

  const resize = useCallback(
    (id: WidgetId) =>
      update((prev) =>
        prev.map((widget) =>
          widget.id === id
            ? { ...widget, size: widget.size === 'wide' ? 'standard' : 'wide' }
            : widget,
        ),
      ),
    [update],
  );

  const reset = useCallback(() => update(() => DEFAULT_LAYOUT), [update]);

  const visible = useMemo(
    () => layout.filter((widget) => widget.visible && WIDGET_META[widget.id].available),
    [layout],
  );
  const hidden = useMemo(
    () => layout.filter((widget) => !widget.visible && WIDGET_META[widget.id].available),
    [layout],
  );

  return { layout, visible, hidden, move, moveBy, toggle, resize, reset };
}

export function useDashboardData(today: string, layout: WidgetState[]) {
  const queryClient = useQueryClient();

  const isOn = (...ids: WidgetId[]) =>
    layout.some((w) => ids.includes(w.id) && w.visible && WIDGET_META[w.id].available);

  const summary = useQuery({ queryKey: QUERY_KEYS.summary, queryFn: loadSummary });

  const activity = useQuery({
    queryKey: [...QUERY_KEYS.activity, today],
    queryFn: () => loadActivity(today),
    enabled: isOn('heatmap', 'dueDormant'),
  });

  const recent = useQuery({
    queryKey: QUERY_KEYS.recent,
    queryFn: loadRecentEntries,
    enabled: isOn('recent', 'continue'),
  });

  const recentEntries = recent.data;
  const recentProjectIds = useMemo(
    () => Array.from(new Set((recentEntries ?? []).map((entry) => entry.projectId))),
    [recentEntries],
  );
  const fieldData = useQueries({
    queries: recentProjectIds.map((projectId) => ({
      queryKey: ['field-definitions', projectId],
      queryFn: () => loadFieldDefinitions(projectId),
      enabled: isOn('recent'),
    })),
    combine: combineFieldData,
  });
  const durations = useMemo(
    () => buildDurations(recentEntries ?? [], recentProjectIds, fieldData),
    [recentEntries, recentProjectIds, fieldData],
  );

  const unfinished = useQuery({
    queryKey: QUERY_KEYS.unfinished,
    queryFn: loadUnfinished,
    enabled: isOn('whatsLeft', 'dueDormant'),
  });

  const insight = useQuery({
    queryKey: QUERY_KEYS.insight,
    queryFn: loadInsight,
    enabled: isOn('insight'),
  });

  const frequency = useQuery({
    queryKey: QUERY_KEYS.frequency,
    queryFn: loadFrequency,
    enabled: isOn('frequency'),
  });

  const upcoming = useQuery({
    queryKey: QUERY_KEYS.upcoming,
    queryFn: loadUpcoming,
    enabled: isOn('upcoming'),
  });

  const markDone = useMutation({
    mutationFn: (item: UnfinishedItem) => markEntryFieldDone(item.entryId, item.fieldName),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.unfinished });
      const previous = queryClient.getQueryData<UnfinishedStats>(QUERY_KEYS.unfinished);
      queryClient.setQueryData<UnfinishedStats>(QUERY_KEYS.unfinished, (old) =>
        old ? withoutItem(old, item) : old,
      );
      return { previous };
    },
    onError: (_error, _item, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.unfinished, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unfinished }),
  });

  return useMemo(
    () => ({
      summary,
      activity,
      recent,
      durations,
      unfinished,
      insight,
      frequency,
      upcoming,
      markDone,
    }),
    [summary, activity, recent, durations, unfinished, insight, frequency, upcoming, markDone],
  );
}

export const CARD = 'rounded-xl bg-[#F5EBE0] p-4';
export const LABEL = 'text-[11px] font-medium uppercase tracking-[0.08em] text-[#7a5230]';
export const MUTED = 'text-[#7a5230]';
export const GOLD_BUTTON =
  'inline-flex items-center justify-center rounded-full bg-[#D4A843] px-4 py-1.5 text-sm font-semibold text-[#1c0d06] transition-colors hover:bg-[#C99B36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c0d06]';
export const DARK_BUTTON =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1C0D06] px-3.5 py-2 text-sm font-medium text-[#FFFCF7] transition-colors hover:bg-[#3A2214] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]';
export const TEXT_BUTTON =
  'rounded-md px-2 py-1.5 text-sm text-[#5C4630] transition-colors hover:text-[#1C0D06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]';
