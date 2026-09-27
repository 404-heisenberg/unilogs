import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/entries': 'Entries',
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
function HeaderAction({ pathname }: { pathname: string }) {
  if (pathname === '/dashboard' || pathname === '/projects') {
    const isProjects = pathname === '/projects';
    return (
      // 44px tap target around the 32px pill.
      <Link
        to={isProjects ? '/projects/new' : '/entries/new'}
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-rule bg-canvas px-4 md:hidden">
      {/* Not a heading: each page still renders its own <h1> (visually hidden
          on mobile), and a page must have only one. */}
      <p className="truncate text-lg font-bold text-espresso">{titleFor(pathname)}</p>
      <HeaderAction pathname={pathname} />
    </header>
  );
}
