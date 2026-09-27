import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FiltersSheet from '@/components/entries/FiltersSheet';
import { api } from '@/lib/api';
import {
  DATE_RANGE_LABELS,
  DEFAULT_FILTERS,
  buildEntriesQuery,
  isFiltering,
  type DateRangeKey,
  type EntryFilters,
} from '@/lib/entryFilters';
import type { Entry, PagedEntries, Project } from '@/types';
import { projectColor } from '@/lib/colors';

const QUICK_RANGES: DateRangeKey[] = ['all', 'today', '7d'];

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

function entryHeadline(entry: Entry): { headline: string; snippet: string | null } {
  if (entry.title) {
    return { headline: entry.title, snippet: entry.body ?? contentSnippet(entry) };
  }
  const fromContent = contentSnippet(entry);
  return { headline: fromContent ?? 'Untitled entry', snippet: entry.body ?? null };
}

function contentSnippet(entry: Entry): string | null {
  const parts = Object.entries(entry.content).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: ['entries', filters],
    queryFn: () => api.get<PagedEntries>(`/api/entries${buildEntriesQuery(filters)}`),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

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

  const hasAnyEntries = entries.length > 0 || isFiltering(filters);
  const filtering = isFiltering(filters);

  return (
    <div>
      <div className="flex items-center justify-between md:mb-4">
        <h1 className="sr-only text-2xl font-bold tracking-tight md:not-sr-only">Entries</h1>
        <Link to="/entries/new" className="hidden md:block">
          <Button className="min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-0">
            New Entry
          </Button>
        </Link>
      </div>

      {hasAnyEntries && (
        <div className="mb-6 flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_RANGES.map((key) => {
            const active = filters.dateRange === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, dateRange: key }))}
                className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-medium ${
                  active
                    ? 'border border-gold bg-gold text-rail'
                    : 'border border-caramel/40 text-clay'
                }`}
              >
                {DATE_RANGE_LABELS[key]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filters"
            className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${
              filtering ? 'border-gold text-gold' : 'border-caramel/40 text-clay'
            }`}
          >
            <SlidersHorizontal size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {isPending && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-caramel/20" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
          Failed to load entries. Try refreshing the page.
        </div>
      )}

      {!isPending && !isError && entries.length === 0 && !filtering && (
        <div className="rounded-xl border border-dashed border-caramel/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-cocoa">No entries yet.</p>
          <Link to="/entries/new">
            <Button className="mt-4 min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-0">
              Log your first entry
            </Button>
          </Link>
        </div>
      )}

      {!isPending && !isError && entries.length === 0 && filtering && (
        <div className="rounded-xl border border-dashed border-caramel/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-cocoa">No entries match your filters.</p>
          <Button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-4 min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-0"
          >
            Clear filters
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(([label, groupEntries]) => (
          <div key={label} className="flex flex-col gap-3">
            <p className="text-sm font-bold text-espresso">{label}</p>
            <ul className="flex flex-col gap-3">
              {groupEntries.map((entry) => {
                const { headline, snippet } = entryHeadline(entry);
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-cream bg-paper p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/projects/${entry.projectId}`}
                        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold tracking-wide text-clay uppercase hover:underline"
                      >
                        <span
                          className="size-[8px] shrink-0 rounded-full"
                          style={{ backgroundColor: projectColor(entry.projectId) }}
                          aria-hidden
                        />
                        {projectNames.get(entry.projectId) ?? 'Unknown project'}
                      </Link>
                      <p className="text-xs text-clay">
                        {new Date(entry.date).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Link to={`/entries/${entry.id}`} className="mt-1 block min-h-11">
                      <p className="font-semibold text-espresso">{headline}</p>
                      {snippet && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-cocoa">{snippet}</p>
                      )}
                    </Link>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {entry.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-caramel/20 px-2 py-0.5 text-[11px] font-medium text-clay"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <FiltersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projects={projects ?? []}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  );
}
