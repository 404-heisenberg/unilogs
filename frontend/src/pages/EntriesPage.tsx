import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useSession } from '@/hooks/useSession';
import type { LogEntry } from '@/types';
import {
  LayoutDashboard,
  Folder,
  FileText,
  User as UserIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Calendar,
} from 'lucide-react';

// Safely extract a printable string from string, number, or { id, type, label, value } objects
const getDisplayText = (val: unknown): string => {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.value === 'string') return obj.value;
  }
  return '';
};

export default function EntriesPage() {
  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();

  // Session & User Resolution
  const { data: sessionData } = useSession();
  const userObj = sessionData?.user || (sessionData as Record<string, unknown>);

  const userName =
    (typeof userObj?.name === 'string' && userObj.name) ||
    (typeof userObj?.fullName === 'string' && userObj.fullName) ||
    (typeof userObj?.full_name === 'string' && userObj.full_name) ||
    (typeof userObj?.username === 'string' && userObj.username) ||
    (typeof userObj?.email === 'string' ? userObj.email.split('@')[0] : 'User');

  const userInitial = userName.charAt(0).toUpperCase();

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Proceed with redirect regardless of network status
    } finally {
      navigate('/login');
    }
  };

  // TanStack Query Integration
  const {
    data: rawEntries,
    isPending,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['entries'],
    queryFn: () => api.get<LogEntry[]>('/api/entries'),
  });

  const entriesList: LogEntry[] = Array.isArray(rawEntries)
    ? rawEntries
    : Array.isArray((rawEntries as unknown as { data: LogEntry[] })?.data)
      ? (rawEntries as unknown as { data: LogEntry[] }).data
      : [];

  const filteredEntries = entriesList.filter((entry) => {
    if (!entry) return false;
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const titleText = getDisplayText(entry.title).toLowerCase();
    const contentText = getDisplayText(entry.content).toLowerCase();

    return titleText.includes(term) || contentText.includes(term);
  });

  const loadingState = isPending || isLoading;

  return (
    <div className="flex min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      {/* 1. SIDEBAR NAVIGATION */}
      <aside
        className={`flex flex-col justify-between border-r-2 border-[#d4af37] bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          <header className="flex h-20 items-center justify-between border-b border-[#d4af37]/30 px-4">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold tracking-wider text-[#e6c687]">UNILOGS</h1>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="rounded-md p-2 text-[#e6c687] hover:bg-[#2a150a] focus:outline-none"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </header>

          <nav className="p-4">
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  to="/dashboard"
                  className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
                >
                  <LayoutDashboard size={20} className="shrink-0" />
                  {!isSidebarCollapsed && <span>Dashboard</span>}
                </Link>
              </li>
              <li>
                <Link
                  to="/projects"
                  className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
                >
                  <Folder size={20} className="shrink-0" />
                  {!isSidebarCollapsed && <span>Projects</span>}
                </Link>
              </li>
              <li>
                <Link
                  to="/entries"
                  className="flex w-full items-center gap-3 rounded-md bg-[#d4a373] p-3 font-semibold text-[#1c0d06] transition-colors"
                >
                  <FileText size={20} className="shrink-0" />
                  {!isSidebarCollapsed && <span>All Entries</span>}
                </Link>
              </li>
              <li>
                <Link
                  to="/profile"
                  className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
                >
                  <UserIcon size={20} className="shrink-0" />
                  {!isSidebarCollapsed && <span>Profile Information</span>}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Sidebar Footer with Logout Button */}
        <footer className="border-t border-[#d4af37]/30 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
          >
            <LogOut size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </footer>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="flex h-20 items-center justify-between border-b-2 border-[#d4af37] bg-[#1c0d06] px-8 text-[#f5ebe0] shadow-md">
          <h2 className="text-2xl font-bold tracking-tight text-[#e6c687]">ALL ENTRIES</h2>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
              {userInitial}
            </span>
          </div>
        </header>

        {/* Main Workspace Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">Log Entries</h1>
                <p className="mt-1 text-sm text-[#7a5230]">
                  Browse and filter all daily work and milestones.
                </p>
              </div>
              <Link to="/entries/new">
                <Button className="border border-[#d4af37]/30 bg-[#1c0d06] text-[#f5ebe0] shadow-sm hover:bg-[#1c0d06]/90">
                  <Plus className="mr-1.5 h-4 w-4 text-[#d4af37]" /> New Entry
                </Button>
              </Link>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a5230]" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#d4a373]/50 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1c0d06] outline-none transition-all focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]"
              />
            </div>

            {loadingState && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border border-[#d4a373]/30 bg-[#d4a373]/20"
                  />
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Failed to load log entries.
              </div>
            )}

            {!loadingState && !isError && filteredEntries.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/50 p-12 text-center">
                <p className="text-base font-medium text-[#1c0d06]">No log entries found.</p>
              </div>
            )}

            {!loadingState && filteredEntries.length > 0 && (
              <ul className="flex flex-col gap-4">
                {filteredEntries.map((entry) => {
                  const displayTitle = getDisplayText(entry.title) || 'Untitled Entry';
                  const displayContent = getDisplayText(entry.content);
                  const displayProject = getDisplayText(entry.project);

                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-[#d4af37]/30 bg-white p-5 shadow-sm transition-all hover:border-[#d4af37]/60 hover:shadow-md"
                    >
                      <Link to={`/entries/${entry.id}`} className="group block">
                        <h3 className="font-semibold text-[#1c0d06] transition-colors group-hover:text-[#7a5230]">
                          {displayTitle}
                        </h3>
                        {displayContent && (
                          <p className="mt-1 line-clamp-2 text-sm text-[#7a5230]">
                            {displayContent}
                          </p>
                        )}
                      </Link>
                      <div className="mt-4 flex items-center gap-4 text-xs font-medium text-[#7a5230]">
                        {displayProject && (
                          <span className="flex items-center gap-1 rounded-md bg-[#f5ebe0] px-2 py-1 text-[#1c0d06]">
                            <Folder size={13} className="text-[#d4af37]" />
                            {displayProject}
                          </span>
                        )}
                        {entry.createdAt && !isNaN(Date.parse(String(entry.createdAt))) && (
                          <span className="flex items-center gap-1">
                            <Calendar size={13} />
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
