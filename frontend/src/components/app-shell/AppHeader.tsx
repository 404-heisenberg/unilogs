import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Clock, CornerUpLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { Project } from '@/types';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/entries': 'Entries',
  '/calendar': 'Calendar',
  '/settings': 'Settings',
  '/suggestions': 'Suggestions',
};

function titleFor(pathname: string) {
  const match = Object.keys(pageTitles).find(
    (to) => pathname === to || pathname.startsWith(`${to}/`),
  );
  return match ? pageTitles[match] : 'UniLogs';
}

// The top bar's action, per page, as in the Figma mobile frames: Dashboard
// logs an entry (dark "Log"), Projects creates a project (gold "New"), and
// everything else falls back to the round gold log-entry button.
function HeaderAction({ pathname, projectId }: { pathname: string; projectId: string | null }) {
  if (pathname === '/dashboard' || pathname === '/projects' || projectId) {
    const isProjects = pathname === '/projects';
    const logTo = projectId ? `/entries/new?projectId=${projectId}` : '/entries/new';
    return (
      // 44px tap target around the 32px pill.
      <Link
        to={isProjects ? '/projects/new' : logTo}
        aria-label={isProjects ? 'New project' : 'Log entry'}
        className="-mr-1 flex min-h-11 items-center px-1"
      >
        <span
          className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-opacity hover:opacity-90 ${
            isProjects ? 'rounded-lg bg-gold text-espresso' : 'rounded-md bg-espresso text-cream'
          }`}
        >
          <Plus size={14} strokeWidth={2} aria-hidden />
          {isProjects ? 'New' : 'Log'}
        </span>
      </Link>
    );
  }

  // The calendar's Figma frame spells the action out as a gold button.
  if (pathname === '/calendar') {
    return (
      <Link
        to="/entries/new"
        className="flex h-10 items-center rounded-lg bg-gold px-4 text-[13px] font-bold text-espresso transition-opacity hover:opacity-90"
      >
        Log entry
      </Link>
    );
  }

  return (
    <Link
      to="/entries/new"
      aria-label="Log entry"
      className="flex size-11 items-center justify-center rounded-full bg-gold text-espresso transition-opacity hover:opacity-90"
    >
      <Plus size={16} strokeWidth={2} />
    </Link>
  );
}

// Mobile only. On desktop each page owns its title and actions (Figma has no
// top bar there); on mobile this is the single top bar and pages hide their
// own title row.
export default function AppHeader() {
  const { pathname } = useLocation();
  // A project page shows Figma's back arrow + project name instead of a
  // section title. Same query as the workspace, so it's served from cache.
  const projectId = pathname.match(/^\/projects\/(\d+)$/)?.[1] ?? null;
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: projectId !== null,
  });

  // The as-at view replaces the whole bar: back arrow, its own title, and a
  // way back to the live timeline instead of the log-entry action.
  if (pathname === '/entries/as-at') {
    return (
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-cream bg-white px-4 md:hidden">
        <div className="flex min-w-0 items-center">
          <Link
            to="/entries"
            aria-label="Back to entries"
            className="-ml-3 flex size-11 shrink-0 items-center justify-center text-espresso"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </Link>
          <p className="truncate text-lg font-bold text-espresso">As at</p>
        </div>
        {/* 44px tap target around the 30px pill. */}
        <Link to="/entries" className="-mr-1 flex min-h-11 items-center px-1">
          <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-clay px-2.5 py-1.5 text-[13px] font-bold text-clay">
            <CornerUpLeft size={12} strokeWidth={2} aria-hidden />
            Back to current
          </span>
        </Link>
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-rule bg-canvas px-4 md:hidden">
      {/* Not a heading: each page still renders its own <h1> (visually hidden
          on mobile), and a page must have only one. */}
      {projectId ? (
        <div className="flex min-w-0 items-center">
          <Link
            to="/projects"
            aria-label="Back to projects"
            className="-ml-3 flex size-11 shrink-0 items-center justify-center text-espresso"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </Link>
          <p className="truncate text-lg font-bold text-espresso">
            {project.data?.name ?? 'Project'}
          </p>
        </div>
      ) : (
        <p className="truncate text-lg font-bold text-espresso">{titleFor(pathname)}</p>
      )}
      {pathname === '/entries' ? (
        // The page's own History button is desktop-only, so the timeline's
        // way into the as-at view lives up here on mobile.
        <div className="flex items-center gap-2">
          <Link
            to="/entries/as-at"
            aria-label="History"
            className="flex size-11 items-center justify-center rounded-full border border-line text-clay"
          >
            <Clock size={16} strokeWidth={2} aria-hidden />
          </Link>
          <HeaderAction pathname={pathname} projectId={projectId} />
        </div>
      ) : (
        <HeaderAction pathname={pathname} projectId={projectId} />
      )}
    </header>
  );
}
