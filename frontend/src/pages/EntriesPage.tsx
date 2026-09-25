import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  CheckSquare,
  Square,
  Clock,
  SlidersHorizontal,
  X,
  Tag as TagIcon,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import FiltersSheet from '@/components/entries/FiltersSheet';
import { api } from '@/lib/api';
import {
  DEFAULT_FILTERS,
  buildEntriesQuery,
  isFiltering,
  type DateRangeKey,
  type EntryFilters,
} from '@/lib/entryFilters';
import type { Entry, PagedEntries, Project, Tag } from '@/types';

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  all: 'All time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};

const QUICK_RANGES: DateRangeKey[] = ['all', 'today', '7d', '30d', 'custom'];

const DOT_COLORS = ['#d1a153', '#5b82a6', '#4a8067', '#9c5a9c', '#c4664a'];
const dotColorFor = (id: number) => DOT_COLORS[id % DOT_COLORS.length];

function groupDateFormatted(iso: string): { primary: string; secondary: string | null } {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const formattedDate = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (sameDay(date, today)) {
    return { primary: 'Today', secondary: `· ${formattedDate}` };
  }
  if (sameDay(date, yesterday)) {
    return { primary: 'Yesterday', secondary: `· ${formattedDate}` };
  }
  return { primary: formattedDate, secondary: null };
}

function entryHeadline(entry: Entry): { headline: string; snippet: string | null } {
  if (entry.title) {
    return { headline: entry.title, snippet: entry.body ?? contentSnippet(entry) };
  }
  const fromContent = contentSnippet(entry);
  return { headline: fromContent ?? 'Untitled entry', snippet: entry.body ?? null };
}

function contentSnippet(entry: Entry): string | null {
  if (!entry.content) return null;
  const parts = Object.entries(entry.content).map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function getTimeSpent(entry: Entry): string | null {
  if (entry.content && entry.content.timeSpent) {
    return String(entry.content.timeSpent);
  }
  return null;
}

function isEntryUnfinished(entry: Entry): boolean {
  if (entry.isCompleted !== undefined) return !entry.isCompleted;
  if (entry.content && typeof entry.content.completed === 'boolean') {
    return !entry.content.completed;
  }
  return false;
}

function isEntryOverdue(entry: Entry): boolean {
  if (!entry.dueDate) return false;
  const due = new Date(entry.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today && isEntryUnfinished(entry);
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'unfinished' | 'overdue' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch entries
  const { data, isPending, isError } = useQuery({
    queryKey: ['entries', filters],
    queryFn: () => api.get<PagedEntries>(`/api/entries${buildEntriesQuery(filters)}`),
  });

  const rawEntries = useMemo(() => data?.entries ?? [], [data]);

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/api/tags').catch(() => []),
  });

  // Unique tags fallback from entries if tag endpoint is empty
  const availableTags = useMemo(() => {
    if (tagsData && Array.isArray(tagsData) && tagsData.length > 0) return tagsData;
    const tagMap = new Map<number, Tag>();
    for (const entry of rawEntries) {
      if (entry.tags) {
        for (const t of entry.tags) {
          if (t.tag) tagMap.set(t.tag.id, t.tag);
        }
      }
    }
    return Array.from(tagMap.values());
  }, [tagsData, rawEntries]);

  const projectNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const project of projects ?? []) map.set(project.id, project.name);
    return map;
  }, [projects]);

  // Status counts across raw dataset
  const { unfinishedCount, overdueCount } = useMemo(() => {
    let unfinished = 0;
    let overdue = 0;
    for (const entry of rawEntries) {
      if (isEntryUnfinished(entry)) unfinished++;
      if (isEntryOverdue(entry)) overdue++;
    }
    return { unfinishedCount: unfinished, overdueCount: overdue };
  }, [rawEntries]);

  // Memoized client-side filtering pass
  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const { headline, snippet } = entryHeadline(entry);
        const matchesTitle = headline.toLowerCase().includes(query);
        const matchesSnippet = snippet ? snippet.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesSnippet) return false;
      }

      if (statusFilter === 'unfinished' && !isEntryUnfinished(entry)) return false;
      if (statusFilter === 'overdue' && !isEntryOverdue(entry)) return false;

      if (selectedTagIds.length > 0) {
        const entryTagIds = entry.tags?.map((t) => t.tag.id) ?? [];
        const hasAllTags = selectedTagIds.every((id) => entryTagIds.includes(id));
        if (!hasAllTags) return false;
      }

      return true;
    });
  }, [rawEntries, searchQuery, statusFilter, selectedTagIds]);

  // Memoized date grouping using local calendar day
  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of filteredEntries) {
      const d = new Date(entry.date);
      const localDateKey = isNaN(d.getTime())
        ? entry.date.slice(0, 10)
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const bucket = map.get(localDateKey);
      if (bucket) bucket.push(entry);
      else map.set(localDateKey, [entry]);
    }
    return Array.from(map.entries()).map(([, entriesList]) => ({
      rawDate: entriesList[0].date,
      entries: entriesList,
    }));
  }, [filteredEntries]);

  const activeFilterCount =
    (isFiltering(filters) ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    selectedTagIds.length +
    (statusFilter ? 1 : 0);

  const handleClearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
    setSelectedTagIds([]);
    setStatusFilter(null);
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const scrollToDateGroup = (rawDate: string) => {
    const el = document.getElementById(`group-${rawDate}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] p-6 text-[#1c0d06] md:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Top Header & Search Input */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-[#1c0d06]">Entries</h1>

          {/* Search bar top right */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-[#e6ded6] bg-[#fcfaf7] py-2 pl-4 pr-10 text-sm text-[#1c0d06] placeholder-[#a39588] shadow-sm transition-all focus:border-[#d1a153] focus:bg-white focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c7b6e] hover:text-[#1c0d06]"
              >
                <X size={14} />
              </button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[#a39588]" />
            )}
          </div>
        </div>

        {/* Shared Filter Bar */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {/* Project Select Dropdown Pill */}
          <div className="relative inline-block">
            <select
              value={filters.projectId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  projectId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="appearance-none rounded-full border border-[#e6ded6] bg-[#fcfaf7] py-1.5 pl-4 pr-8 text-xs font-medium text-[#5c4a3e] shadow-sm hover:border-[#d1a153] focus:outline-none"
            >
              <option value="">All projects</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8c7b6e]" />
          </div>

          {/* Date Range Quick Pills */}
          {QUICK_RANGES.map((key) => {
            const active = filters.dateRange === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, dateRange: key }))}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all ${
                  active
                    ? 'bg-[#d1a153] text-[#1c1109]'
                    : 'border border-[#e6ded6] bg-[#fcfaf7] text-[#5c4a3e] hover:border-[#d1a153]'
                }`}
              >
                {DATE_RANGE_LABELS[key]}
              </button>
            );
          })}

          {/* Unfinished Status Chip */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'unfinished' ? null : 'unfinished'))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all ${
              statusFilter === 'unfinished'
                ? 'border-[#1c0d06] bg-[#1c0d06] text-[#f5ebe0]'
                : 'border-[#e6ded6] bg-[#fcfaf7] text-[#5c4a3e] hover:border-[#d1a153]'
            }`}
          >
            <CheckSquare size={13} className="text-[#8c7b6e]" />
            <span>Unfinished</span>
            <span className="text-[#8c7b6e]">· {unfinishedCount}</span>
          </button>

          {/* Overdue Status Chip */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'overdue' ? null : 'overdue'))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all ${
              statusFilter === 'overdue'
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-[#e6ded6] bg-[#fcfaf7] text-[#5c4a3e] hover:border-red-400'
            }`}
          >
            <Clock size={13} className="text-[#8c7b6e]" />
            <span>Overdue</span>
            <span className="text-[#8c7b6e]">· {overdueCount}</span>
          </button>

          {/* Shared Tag Chips */}
          {availableTags.map((t) => {
            const active = selectedTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                  active
                    ? 'border-[#8c7b6e] bg-[#8c7b6e] text-white'
                    : 'border-[#e6ded6] bg-[#fcfaf7] text-[#5c4a3e] hover:border-[#d1a153]'
                }`}
              >
                <TagIcon size={11} />
                <span>#{t.name}</span>
              </button>
            );
          })}

          {/* Mobile Filters Sheet Trigger */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Open filter sheet"
            className="ml-auto flex size-8 items-center justify-center rounded-full border border-[#e6ded6] bg-white text-[#5c4a3e] md:hidden"
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Loading / Error States */}
        {isPending && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#ebe3d8]" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load entries. Please refresh to try again.
          </div>
        )}

        {!isPending && !isError && rawEntries.length === 0 && !activeFilterCount && (
          <div className="rounded-2xl border border-dashed border-[#e6ded6] bg-white/60 p-12 text-center">
            <p className="text-sm font-medium text-[#7a6b5d]">No entries recorded yet.</p>
            <Link to="/entries/new">
              <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
                Create First Entry
              </Button>
            </Link>
          </div>
        )}

        {!isPending && !isError && filteredEntries.length === 0 && activeFilterCount > 0 && (
          <div className="rounded-2xl border border-dashed border-[#e6ded6] bg-white/60 p-12 text-center">
            <p className="text-sm font-medium text-[#7a6b5d]">
              No entries match the selected filters.
            </p>
            <Button
              onClick={handleClearAllFilters}
              className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
            >
              Clear filters
            </Button>
          </div>
        )}

        {/* Desktop Layout Grid: Main Content + Recency Explorer Outline Sidebar */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Main Date Group Timeline Column */}
          <div className="space-y-8 lg:col-span-3">
            {groups.map((group) => {
              const { primary, secondary } = groupDateFormatted(group.rawDate);

              return (
                <section
                  key={group.rawDate}
                  id={`group-${group.rawDate}`}
                  className="scroll-mt-6 space-y-3"
                >
                  {/* Date Group Header */}
                  <div className="flex items-baseline gap-1.5 text-sm">
                    <span className="font-bold text-[#1c0d06]">{primary}</span>
                    {secondary && <span className="text-[#8c7b6e]">{secondary}</span>}
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {group.entries.map((entry) => {
                      const { headline, snippet } = entryHeadline(entry);
                      const unfinished = isEntryUnfinished(entry);
                      const overdue = isEntryOverdue(entry);
                      const timeSpent = getTimeSpent(entry);

                      return (
                        <div
                          key={entry.id}
                          className="group flex flex-col justify-between rounded-2xl border border-[#ebdcd0] bg-white p-5 shadow-xs transition-all hover:shadow-md"
                        >
                          <div>
                            {/* Top Row: Project Tag & Property Summary Header */}
                            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-[#8c7b6e] uppercase">
                              <Link
                                to={`/projects/${entry.projectId}`}
                                className="flex items-center gap-1.5 hover:underline"
                              >
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: dotColorFor(entry.projectId) }}
                                />
                                <span>{projectNames.get(entry.projectId) ?? 'PROJECT'}</span>
                              </Link>

                              {/* Right-aligned property summary */}
                              <div className="flex items-center gap-2 text-xs font-normal tracking-normal text-[#8c7b6e]/80">
                                {timeSpent && (
                                  <span className="flex items-center gap-1 font-medium text-[#1c0d06]">
                                    <Clock size={12} />
                                    {timeSpent}
                                  </span>
                                )}
                                <span>
                                  {new Date(entry.date).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Title (Muted Red if Overdue) & Open Checkbox State */}
                            <Link to={`/entries/${entry.id}`} className="block">
                              <h3
                                className={`flex items-start gap-2 text-base font-semibold leading-snug ${
                                  overdue ? 'text-[#c44536]' : 'text-[#1c0d06]'
                                }`}
                              >
                                {unfinished && (
                                  <Square
                                    size={16}
                                    className="mt-1 shrink-0 text-[#8c7b6e] group-hover:text-[#1c0d06]"
                                  />
                                )}
                                <span>{headline}</span>
                              </h3>

                              {/* Snippet */}
                              {snippet && (
                                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#5c4a3e]">
                                  {snippet}
                                </p>
                              )}
                            </Link>

                            {/* Tag Chips on Entry Card */}
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {entry.tags.map(({ tag }) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center gap-0.5 rounded-md bg-[#f4eee6] px-2 py-0.5 text-[10px] font-medium text-[#6e5d50]"
                                  >
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer Badges (Overdue notice or time spent fallback) */}
                          {(timeSpent || overdue) && (
                            <div className="mt-4 flex items-center gap-1.5 text-xs text-[#8c7b6e]">
                              {timeSpent && !overdue && (
                                <span className="flex items-center gap-1">
                                  <Clock size={13} />
                                  {timeSpent}
                                </span>
                              )}
                              {overdue && (
                                <span className="flex items-center gap-1 font-medium text-[#c44536]">
                                  <Clock size={13} className="text-[#c44536]" />
                                  Overdue · due {formatDueDate(entry.dueDate!)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Recency Explorer Outline Sidebar (Desktop) */}
          {groups.length > 0 && (
            <aside className="hidden lg:block lg:col-span-1">
              <div className="sticky top-6 rounded-2xl border border-[#ebdcd0] bg-white/70 p-4 backdrop-blur-xs">
                <div className="mb-3 flex items-center gap-2 border-b border-[#e6ded6] pb-2 text-xs font-bold tracking-wider text-[#8c7b6e] uppercase">
                  <Calendar size={13} />
                  <span>Recency Outline</span>
                </div>
                <nav className="space-y-1">
                  {groups.map((group) => {
                    const { primary } = groupDateFormatted(group.rawDate);
                    return (
                      <button
                        key={group.rawDate}
                        type="button"
                        onClick={() => scrollToDateGroup(group.rawDate)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-[#5c4a3e] transition-colors hover:bg-[#f4eee6] hover:text-[#1c0d06]"
                      >
                        <span className="truncate font-medium">{primary}</span>
                        <span className="ml-2 rounded-full bg-[#f0e8de] px-1.5 py-0.5 text-[10px] text-[#8c7b6e]">
                          {group.entries.length}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
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
