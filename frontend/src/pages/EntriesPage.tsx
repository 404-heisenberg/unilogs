import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Entry, EntryContent, Project } from '@/types';

// Search runs client-side over the entries already loaded for this view. That is
// fine at Basic-tier scale (see issue #85). If entry volume grows enough that
// loading them all becomes expensive, move the filtering behind a backend search
// endpoint.
function contentMatches(content: EntryContent, term: string): boolean {
  const walk = (value: unknown): boolean => {
    if (value == null) return false;
    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some(walk);
    }
    return String(value).toLowerCase().includes(term);
  };
  return walk(content);
}

export default function EntriesPage() {
  const [search, setSearch] = useState('');

  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['entries'],
    queryFn: () => api.get<Entry[]>('/api/entries'),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const projectNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const project of projects ?? []) {
      map.set(project.id, project.name);
    }
    return map;
  }, [projects]);

  const term = search.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!term) return entries ?? [];
    return (entries ?? []).filter((entry) => {
      const projectName = projectNames.get(entry.projectId)?.toLowerCase() ?? '';
      return projectName.includes(term) || contentMatches(entry.content, term);
    });
  }, [entries, projectNames, term]);

  const hasEntries = (entries?.length ?? 0) > 0;
  const noResults = hasEntries && term.length > 0 && filteredEntries.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Entries</h1>
        <Link to="/entries/new">
          <Button className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">New Entry</Button>
        </Link>
      </div>

      {hasEntries && (
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries by project or content…"
            aria-label="Search entries"
            className="w-full rounded-xl border border-[#d4a373]/40 bg-white px-4 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />
        </div>
      )}

      {isPending && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#d4a373]/20" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load entries. Try refreshing the page.
        </div>
      )}

      {entries?.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">No entries yet.</p>
          <Link to="/entries/new">
            <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
              Log your first entry
            </Button>
          </Link>
        </div>
      )}

      {noResults && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">
            No entries match <span className="font-semibold text-[#1c0d06]">{search.trim()}</span>.
          </p>
          <Button
            onClick={() => setSearch('')}
            className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
          >
            Clear search
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {filteredEntries.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              className="block rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[#1c0d06]">
                  {projectNames.get(entry.projectId) ?? 'Unknown project'}
                </p>
                <p className="text-sm text-[#7a5230]">{entry.date.slice(0, 10)}</p>
              </div>
              <dl className="mt-1 flex flex-col gap-0.5">
                {Object.entries(entry.content).map(([name, value]) => (
                  <div key={name} className="flex gap-2 text-sm">
                    <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                    <dd className="text-[#4a3525]">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
