import { useState } from 'react';
import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import Skeleton from '@/components/Skeleton';
import type { Entry, PagedEntries, Project } from '@/types';
import { isNavActive } from './nav-items';

const EXPANDED_ENTRY_COUNT = 5;

// The project the current page belongs to: a project page, or an entry page
// (whose entry query the page has already loaded into the cache).
function useCurrentProjectId(): { projectId: number | null; entryId: number | null } {
  const { pathname } = useLocation();
  const projectMatch = pathname.match(/^\/projects\/(\d+)/);
  const entryMatch = pathname.match(/^\/entries\/(\d+)/);
  const entryId = entryMatch ? entryMatch[1] : null;
  const entry = useQuery({
    queryKey: ['entry', entryId ?? undefined],
    queryFn: () => api.get<Entry>(`/api/entries/${entryId}`),
    enabled: entryId !== null,
  });
  if (projectMatch) return { projectId: Number(projectMatch[1]), entryId: null };
  return {
    projectId: entry.data?.projectId ?? null,
    entryId: entryId ? Number(entryId) : null,
  };
}

// Figma's explorer: the current project expands to show its recent entries.
function ProjectEntries({
  projectId,
  activeEntryId,
}: {
  projectId: number;
  activeEntryId: number | null;
}) {
  const { data } = useQuery({
    queryKey: ['explorer-entries', projectId],
    queryFn: () =>
      api.get<PagedEntries>(`/api/entries?projectId=${projectId}&limit=${EXPANDED_ENTRY_COUNT}`),
  });
  const entries = data?.entries ?? [];
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => {
        const active = entry.id === activeEntryId;
        return (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-md py-1.5 pr-2 pl-6 text-[13px] transition-colors ${
                active
                  ? 'bg-paper font-semibold text-espresso'
                  : 'text-clay hover:bg-sand/60 hover:text-espresso'
              }`}
            >
              <FileText size={12} strokeWidth={2} className="shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{entry.title || 'Untitled entry'}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const ProjectRow = memo(function ProjectRow({
  project,
  expanded,
  activeEntryId,
  onToggle,
}: {
  project: Project;
  expanded: boolean;
  activeEntryId: number | null;
  onToggle: () => void;
}) {
  const { pathname } = useLocation();
  const active = isNavActive(pathname, `/projects/${project.id}`);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
          aria-expanded={expanded}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-clay transition-colors hover:bg-sand/70 hover:text-espresso"
        >
          <Chevron size={12} strokeWidth={2.5} aria-hidden />
        </button>
        <Link
          to={`/projects/${project.id}`}
          aria-current={active ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-[13px] transition-colors ${
            expanded
              ? 'bg-sand font-semibold text-espresso'
              : 'font-medium text-espresso hover:bg-sand/60'
          }`}
        >
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
        </Link>
      </div>
      {expanded && <ProjectEntries projectId={project.id} activeEntryId={activeEntryId} />}
    </li>
  );
});

export default function ProjectExplorer({ onTakeTour }: { onTakeTour?: () => void }) {
  const {
    data: projects,
    isPending,
    isError,
  } = useQuery({
    // Same queryKey + queryFn as ProjectsPage's default (non-archived) view,
    // so the explorer shares that cache entry instead of firing a second fetch.
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });
  const { projectId, entryId } = useCurrentProjectId();

  // The current project is expanded by default. A chevron click records the
  // user's explicit choice for that project, which then wins over the default.
  // Storing the few overrides as a record keeps the default rule live.
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-clay uppercase">Projects</p>
        <Link
          to="/projects/new"
          aria-label="New Project"
          className="rounded-[6px] border border-line-strong px-2 py-0.75 text-[11px] font-medium text-clay transition-colors hover:bg-sand"
        >
          New
        </Link>
      </div>

      {isPending && <Skeleton rows={3} barClassName="h-7 rounded-md bg-sand" className="gap-1.5" />}

      {isError && <p className="text-xs text-error">Failed to load projects.</p>}

      {projects?.length === 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-clay italic">No projects yet</p>
          {onTakeTour && (
            <button
              type="button"
              onClick={onTakeTour}
              className="self-start text-xs font-medium text-gold hover:underline"
            >
              Take the tour
            </button>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {(projects ?? []).map((project) => {
          const expanded = toggled[project.id] ?? project.id === projectId;
          return (
            <ProjectRow
              key={project.id}
              project={project}
              expanded={expanded}
              activeEntryId={entryId}
              onToggle={() =>
                setToggled((prev) => ({
                  ...prev,
                  [project.id]: !(prev[project.id] ?? project.id === projectId),
                }))
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
