import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { projectColor } from '@/lib/colors';
import {
  dayLabel,
  formatDurationHours,
  toDayKey,
  type ProjectSummary,
} from '@/lib/project-workspace';
import type { Project } from '@/types';

function entryCount(count: number) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

function ProjectCard({
  project,
  summary,
  today,
  archivedView,
  wide,
  onUnarchive,
  isUnarchiving,
}: {
  project: Project;
  wide: boolean;
  summary: ProjectSummary | undefined;
  today: string;
  archivedView: boolean;
  onUnarchive: () => void;
  isUnarchiving: boolean;
}) {
  const tracked =
    summary?.trackedTimeMinutes == null
      ? 'No tracked time'
      : `${formatDurationHours(summary.trackedTimeMinutes / 60)} tracked`;
  const lastLogged = summary?.lastLoggedAt
    ? dayLabel(summary.lastLoggedAt.slice(0, 10), today)
    : '—';

  return (
    <li
      className={`relative flex flex-col gap-2.5 rounded-xl border border-cream bg-paper p-4 transition-shadow hover:shadow-md md:gap-4 md:border-line md:p-5 ${wide ? 'md:col-span-2' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: projectColor(project.id) }}
          aria-hidden
        />
        {/* The link covers the whole card; the Unarchive button sits above it. */}
        <Link
          to={`/projects/${project.id}`}
          className="min-w-0 truncate text-base font-bold text-espresso after:absolute after:inset-0 after:rounded-xl"
        >
          {project.name}
        </Link>
      </div>
      {project.description && (
        <p className="text-xs text-cocoa md:text-[13px]">{project.description}</p>
      )}
      <div className="flex items-center justify-between gap-3 text-[11px] text-clay md:border-t md:border-cream md:pt-4">
        <span>{summary ? `${entryCount(summary.entryCount)} · ${tracked}` : ' '}</span>
        {archivedView ? (
          <button
            type="button"
            onClick={onUnarchive}
            disabled={isUnarchiving}
            className="relative z-10 -my-3 min-h-11 font-semibold text-espresso underline disabled:opacity-50 md:min-h-0"
          >
            Unarchive
          </button>
        ) : (
          <span className="font-medium">
            <span className="hidden md:inline">Last logged: </span>
            <span className="md:font-bold md:text-espresso">{lastLogged}</span>
          </span>
        )}
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const [archivedView, setArchivedView] = useState(false);
  const [today] = useState(() => toDayKey(new Date()));
  const queryClient = useQueryClient();

  const {
    data: projects,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['projects', { archived: archivedView }],
    queryFn: () => api.get<Project[]>(`/api/projects${archivedView ? '?archived=true' : ''}`),
  });

  // Only for the "N archived projects" count under the active list.
  const archived = useQuery({
    queryKey: ['projects', { archived: true }],
    queryFn: () => api.get<Project[]>('/api/projects?archived=true'),
    enabled: !archivedView,
  });

  // Same query key as the project workspace, so opening a project reuses it.
  const summaries = useQueries({
    queries: (projects ?? []).map((project) => ({
      queryKey: ['project-summary', String(project.id)],
      queryFn: () => api.get<ProjectSummary>(`/api/projects/${project.id}/summary`),
    })),
  });

  const unarchive = useMutation({
    mutationFn: (id: number) => api.post<Project>(`/api/projects/${id}/unarchive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const list = projects ?? [];
  const archivedCount = archived.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 md:gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="sr-only text-[28px] font-bold text-espresso md:not-sr-only">
            {archivedView ? 'Archived projects' : 'Projects'}
          </h1>
          {!isPending && !isError && (
            <p className="hidden text-sm text-clay md:mt-1.5 md:block">
              {archivedView
                ? `${list.length} archived ${list.length === 1 ? 'project' : 'projects'}`
                : `${list.length} active ${list.length === 1 ? 'project' : 'projects'}`}
            </p>
          )}
        </div>
        <Link
          to="/projects/new"
          className="hidden items-center gap-2 rounded-lg bg-rail px-5 py-3 text-sm font-semibold text-cream transition-opacity hover:opacity-90 md:inline-flex"
        >
          <Plus size={14} strokeWidth={2} aria-hidden />
          New project
        </Link>
      </div>

      {unarchive.error && <p className="text-sm text-error">{unarchive.error.message}</p>}

      {isPending && (
        <div className="grid gap-3 md:grid-cols-2 md:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-cream md:h-40" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
          Failed to load projects. Try refreshing the page.
        </div>
      )}

      {projects?.length === 0 &&
        (archivedView ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
            <p className="text-sm text-cocoa">No archived projects.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
            <p className="text-sm text-cocoa">No projects yet.</p>
            <Link
              to="/projects/new"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-espresso px-5 text-sm font-semibold text-cream hover:opacity-90 md:min-h-10"
            >
              Create your first project
            </Link>
          </div>
        ))}

      {list.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2 md:gap-5">
          {list.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              // An odd last card spans both columns, as in the Figma grid.
              wide={index === list.length - 1 && list.length % 2 === 1}
              summary={summaries[index]?.data}
              today={today}
              archivedView={archivedView}
              onUnarchive={() => unarchive.mutate(project.id)}
              isUnarchiving={unarchive.isPending && unarchive.variables === project.id}
            />
          ))}
        </ul>
      )}

      {!isPending && (archivedView || archivedCount > 0) && (
        <div className="flex items-center justify-between gap-2 py-2 text-[13px] text-clay md:justify-start md:border-t md:border-line md:pt-4 md:text-sm">
          <span>
            {archivedView ? (
              'Showing archived projects'
            ) : (
              <>
                <span className="md:hidden">Archived ({archivedCount})</span>
                <span className="hidden md:inline">
                  {archivedCount} archived {archivedCount === 1 ? 'project' : 'projects'}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setArchivedView((v) => !v)}
            className="-my-3 min-h-11 font-bold text-gold hover:underline md:min-h-0"
          >
            {archivedView ? 'Back to active projects' : 'View'}
          </button>
        </div>
      )}
    </div>
  );
}
