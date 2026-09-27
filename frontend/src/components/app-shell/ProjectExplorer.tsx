import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import type { Project } from '@/types';
import { isNavActive } from './nav-items';

const ProjectRow = memo(function ProjectRow({ project }: { project: Project }) {
  const { pathname } = useLocation();
  const active = isNavActive(pathname, `/projects/${project.id}`);

  return (
    <Link
      to={`/projects/${project.id}`}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
        active
          ? 'bg-sand font-semibold text-espresso'
          : 'font-medium text-espresso hover:bg-sand/60'
      }`}
    >
      <ChevronDown size={10} strokeWidth={2.5} className="shrink-0 text-clay" />
      <span className="min-w-0 flex-1 truncate">{project.name}</span>
    </Link>
  );
});

export default function ProjectExplorer() {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-clay uppercase">Projects</p>
        <Link
          to="/projects/new"
          aria-label="New Project"
          className="rounded-[6px] border border-line-strong px-2 py-[3px] text-[11px] font-medium text-clay transition-colors hover:bg-sand"
        >
          New
        </Link>
      </div>

      {isPending && (
        <div className="flex flex-col gap-1.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-sand" />
          ))}
        </div>
      )}

      {isError && <p className="text-xs text-error">Failed to load projects.</p>}

      {projects?.length === 0 && <p className="text-xs text-clay">No projects yet.</p>}

      <div className="flex flex-col gap-0.5">
        {(projects ?? []).map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
