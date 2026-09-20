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

export default function AppHeader() {
  const { pathname } = useLocation();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#5c4a3a] bg-[#faf7f2] px-4 md:px-6">
      {/* Not a heading: each page already renders its own <h1> for this same
          section name, and a page must have only one. */}
      <p className="truncate text-lg font-bold text-[#1c0d06]">{titleFor(pathname)}</p>
      <Link
        to="/entries/new"
        aria-label="Log entry"
        className="flex size-10 items-center justify-center gap-1.5 rounded-full bg-[#d4a843] text-[#1c0d06] transition-opacity hover:opacity-90 sm:h-9 sm:w-auto sm:rounded-lg sm:px-4"
      >
        <Plus size={16} strokeWidth={2} />
        <span className="hidden text-sm font-medium sm:inline">Log entry</span>
      </Link>
    </header>
  );
}
