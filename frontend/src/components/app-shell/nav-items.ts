import { LayoutDashboard, Folder, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

// Module-level so the array identity is stable across renders — nav items
// stay memoised even when AppShell itself re-renders.
export const primaryNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: Folder },
  { to: '/entries', label: 'Entries', icon: FileText },
];

export function isNavActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
