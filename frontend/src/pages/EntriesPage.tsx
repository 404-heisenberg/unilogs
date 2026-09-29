import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock, Plus, Search, SlidersHorizontal, SquareCheck } from 'lucide-react';
import FiltersSheet from '@/components/entries/FiltersSheet';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';
import { projectColor, tagStyle } from '@/lib/colors';
import { QUERY_KEYS, loadUnfinished } from '@/lib/dashboard';
import {
  DATE_RANGE_LABELS,
  DEFAULT_FILTERS,
  buildEntriesQuery,
  isFiltering,
  statusEntryIds,
  type DateRangeKey,
  type EntryFilters,
  type EntryStatus,
} from '@/lib/entryFilters';
import { formatShortDate } from '@/lib/project-workspace';
import { stripMarkdownLine } from '@/lib/sharedReport';
import type { Entry, PagedEntries, Project } from '@/types';

const MOBILE_RANGES: DateRangeKey[] = ['all', 'today', '7d'];
const DESKTOP_RANGES: DateRangeKey[] = ['all', 'today', '7d', '30d', 'custom'];

// Figma's filter chips: 29px pills; the active date range is filled gold.
const CHIP = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px]';

function groupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function markdownSnippet(body: string | null | undefined): string | null {
  if (!body) return null;
  const firstLine = body
    .split('\n')
    .map(stripMarkdownLine)
    .find((line) => line !== '');
  return firstLine ?? null;
}

function entryHeadline(entry: Entry): { headline: string; snippet: string | null } {
  if (entry.title) {
    return { headline: entry.title, snippet: markdownSnippet(entry.body) ?? contentSnippet(entry) };
  }
  const fromContent = contentSnippet(entry);
  return { headline: fromContent ?? 'Untitled entry', snippet: markdownSnippet(entry.body) };
}

function contentSnippet(entry: Entry): string | null {
  const parts = Object.entries(entry.content).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

type DueInfo = { overdue: boolean; dueDate: string | null };

function EntryCard({
  entry,
  projectName,
  due,
  wide,
}: {
  entry: Entry;
  projectName: string;
  due: DueInfo | undefined;
  wide: boolean;
}) {
  const { headline, snippet } = entryHeadline(entry);
  const tags = entry.tags ?? [];
  const dueLabel = due?.dueDate ? formatShortDate(due.dueDate.slice(0, 10)) : null;

  return (
    <li
      className={`relative flex flex-col gap-3 rounded-xl border border-cream bg-paper p-4 transition-shadow hover:shadow-md ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/projects/${entry.projectId}`}
          className="relative z-10 -my-3 inline-flex min-h-11 min-w-0 items-center gap-2 text-[10px] font-bold tracking-[0.04em] text-clay uppercase hover:underline md:min-h-0"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: projectColor(entry.projectId) }}
            aria-hidden
          />
          <span className="truncate">{projectName}</span>
        </Link>
        <p className="shrink-0 text-xs text-clay">
          {new Date(entry.createdAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {/* The title link covers the card; the project link sits above it. */}
        <Link
          to={`/entries/${entry.id}`}
          className="text-base font-semibold text-espresso after:absolute after:inset-0 after:rounded-xl"
        >
          {headline}
        </Link>
        {snippet && <p className="line-clamp-2 text-sm text-cocoa">{snippet}</p>}
      </div>
      {(due || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-caramel/30 pt-3">
          {due?.overdue ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-error">
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
              Overdue{dueLabel ? ` · due ${dueLabel}` : ''}
            </span>
          ) : due ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-clay">
              <SquareCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
              {dueLabel ? `Due ${dueLabel}` : 'Open'}
            </span>
          ) : null}
          {tags.map(({ tag }) => (
            <span
              key={tag.id}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${tagStyle(tag.name)}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The header search box applies 300ms after typing stops, so each keystroke
  // doesn't fire a request. The sheet's search applies on 'Apply filters'.
  const [searchText, setSearchText] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, search: searchText })), 300);
    return () => clearTimeout(timer);
  }, [searchText]);
  const applyFilters = (next: EntryFilters) => {
    setFilters(next);
    setSearchText(next.search);
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['entries', { ...filters, status: null }],
    queryFn: () => api.get<PagedEntries>(`/api/entries${buildEntriesQuery(filters)}`),
  });

  // Same query as the dashboard's "What's left" card.
  const unfinished = useQuery({ queryKey: QUERY_KEYS.unfinished, queryFn: loadUnfinished });
  const statusIds = useMemo(() => statusEntryIds(unfinished.data), [unfinished.data]);

  const dueByEntry = useMemo(() => {
    const map = new Map<number, DueInfo>();
    const groups = unfinished.data;
    if (!groups) return map;
    for (const item of [...groups.dueThisWeek, ...groups.noDueDate]) {
      map.set(item.entryId, { overdue: false, dueDate: item.dueDate });
    }
    for (const item of groups.overdue)
      map.set(item.entryId, { overdue: true, dueDate: item.dueDate });
    return map;
  }, [unfinished.data]);

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    return filters.status ? all.filter((entry) => statusIds[filters.status!].has(entry.id)) : all;
  }, [data, filters.status, statusIds]);

  const { data: projects } = useQuery({
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const projectNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const project of projects ?? []) map.set(project.id, project.name);
    return map;
  }, [projects]);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const label = groupLabel(entry.date);
      const bucket = map.get(label);
      if (bucket) bucket.push(entry);
      else map.set(label, [entry]);
    }
    return Array.from(map.entries());
  }, [entries]);

  const filtering = isFiltering(filters);
  const hasAnyEntries = entries.length > 0 || filtering;
  const statusCounts: Record<EntryStatus, number> = {
    unfinished: statusIds.unfinished.size,
    overdue: statusIds.overdue.size,
  };

  const setStatus = (status: EntryStatus) =>
    setFilters((f) => ({ ...f, status: f.status === status ? null : status }));
  const setRange = (key: DateRangeKey) => {
    if (key === 'custom') setSheetOpen(true);
    else setFilters((f) => ({ ...f, dateRange: key }));
  };

  return (
    <div className="flex flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="sr-only text-[28px] font-bold text-espresso md:not-sr-only">Entries</h1>
        <div className="hidden items-center gap-3 md:flex">
          <label className="flex h-10 w-60 items-center gap-2 rounded-lg border border-line bg-white px-3 focus-within:ring-2 focus-within:ring-espresso">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search entries…"
              aria-label="Search entries"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-espresso outline-none placeholder:text-taupe"
            />
            <Search className="size-4 shrink-0 text-cocoa" strokeWidth={1.75} aria-hidden />
          </label>
          <Link
            to="/entries/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-espresso px-4 text-sm font-semibold text-cream transition-opacity hover:opacity-90"
          >
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            Log entry
          </Link>
        </div>
      </div>

      {hasAnyEntries && (
        <div className="-mb-1 flex items-center gap-1.5 overflow-x-auto pb-1 md:gap-2">
          {/* Desktop: the full Figma chip row. */}
          <label
            className={`${CHIP} relative hidden h-[29px] border-line text-clay md:inline-flex`}
          >
            <span>
              {filters.projectId === null
                ? 'All projects'
                : (projectNames.get(filters.projectId) ?? 'Project')}
            </span>
            <ChevronDown className="size-3" strokeWidth={2} aria-hidden />
            <select
              value={filters.projectId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  projectId: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Project"
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="">All projects</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {DESKTOP_RANGES.map((key) => {
            const active = filters.dateRange === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                aria-pressed={active}
                className={`${CHIP} h-11 md:h-[29px] ${MOBILE_RANGES.includes(key) ? '' : 'hidden md:inline-flex'} ${
                  active
                    ? 'border-gold bg-gold font-semibold text-rail'
                    : 'border-line text-clay hover:border-gold'
                }`}
              >
                {DATE_RANGE_LABELS[key]}
              </button>
            );
          })}
          {(['unfinished', 'overdue'] as const).map((status) => {
            const active = filters.status === status;
            const Icon = status === 'unfinished' ? SquareCheck : Clock;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatus(status)}
                aria-pressed={active}
                className={`${CHIP} hidden h-[31px] pl-2.5 md:inline-flex ${
                  active
                    ? 'border-gold bg-gold/15 font-semibold text-espresso'
                    : 'border-line text-clay'
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                {status === 'unfinished' ? 'Unfinished' : 'Overdue'} · {statusCounts[status]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filters"
            className={`flex size-11 shrink-0 items-center justify-center rounded-full border md:size-[31px] ${
              filtering ? 'border-gold text-gold' : 'border-line text-clay'
            }`}
          >
            <SlidersHorizontal className="size-4 md:size-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {isPending && (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} rows={1} barClassName="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
          Failed to load entries. Try refreshing the page.
        </div>
      )}

      {!isPending && !isError && entries.length === 0 && !filtering && (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
          <p className="text-sm text-cocoa">No entries yet.</p>
          <Link
            to="/entries/new"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-espresso px-5 text-sm font-semibold text-cream hover:opacity-90 md:min-h-10"
          >
            Log your first entry
          </Link>
        </div>
      )}

      {!isPending && !isError && entries.length === 0 && filtering && (
        <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
          <p className="text-sm text-cocoa">No entries match your filters.</p>
          <button
            type="button"
            onClick={() => applyFilters(DEFAULT_FILTERS)}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-espresso px-5 text-sm font-semibold text-cream hover:opacity-90 md:min-h-10"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(([label, groupEntries]) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-espresso">{label}</h2>
            <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
              {groupEntries.map((entry, index) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  projectName={projectNames.get(entry.projectId) ?? 'Unknown project'}
                  due={dueByEntry.get(entry.id)}
                  // A day's odd last card spans both columns, as in Figma.
                  wide={index === groupEntries.length - 1 && groupEntries.length % 2 === 1}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <FiltersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projects={projects ?? []}
        filters={filters}
        statusCounts={statusCounts}
        onApply={applyFilters}
      />
    </div>
  );
}
