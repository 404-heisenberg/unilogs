import { CalendarDays, LayoutGrid, Folder, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

// Module-level so the array identity is stable across renders — nav items
// stay memoised even when AppShell itself re-renders.
export const primaryNavItems: NavItem[] = [
  // A grid over two columns: the dashboards are a set of moveable panels,
  // and LayoutGrid reads as "overview" more than LayoutDashboard did. Jared
  // suggested a pen, but a pen reads as "write an entry" in this app.
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/projects', label: 'Projects', icon: Folder },
  { to: '/entries', label: 'Entries', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
];

export function isNavActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
