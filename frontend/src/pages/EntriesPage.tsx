import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, api } from '../lib/api';

export interface LogEntryItem {
  id: string | number;
  projectId?: string | number;
  projectName?: string;
  project?: {
    id?: string | number;
    name?: string;
  };
  Project?: {
    id?: string | number;
    name?: string;
  };
  date?: string;
  createdAt?: string;
  summary?: string;
  content?: any;
  category?: string;
  hours?: string | number;
  details?: string;
}

export const EntriesPage: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [entries, setEntries] = useState<LogEntryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LogEntryItem | null>(null);

  const navigate = useNavigate();
  const sessionResult = useSession();
  const userObj = sessionResult?.data?.user || (sessionResult?.data as any);

  const userName =
    userObj?.name ||
    userObj?.fullName ||
    userObj?.full_name ||
    userObj?.username ||
    (userObj?.email ? userObj.email.split('@')[0] : 'User');

  const userInitial = userName.charAt(0).toUpperCase();

  // Load entries from backend API
  useEffect(() => {
    setIsLoading(true);
    api
      .get<LogEntryItem[]>('/api/entries')
      .then((data) => {
        if (Array.isArray(data)) {
          setEntries(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load entries from server:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const hasUserEntries = entries.length > 0;

  // Helper resolvers for backend schema variations
  const resolveProjectName = (entry: LogEntryItem): string => {
    return entry.projectName || entry.project?.name || entry.Project?.name || 'Unassigned';
  };

  const resolveEntrySummary = (entry: LogEntryItem): string => {
    if (entry.summary) return entry.summary;
    if (typeof entry.content === 'string') return entry.content;
    if (Array.isArray(entry.content) && entry.content.length > 0) {
      return entry.content[0]?.value || entry.content[0]?.label || 'Log Entry';
    }
    return `Log Entry #${entry.id}`;
  };

  const resolveFormattedDate = (entry: LogEntryItem): string => {
    const rawDate = entry.date || entry.createdAt;
    if (!rawDate) return 'N/A';
    try {
      return new Date(rawDate).toISOString().split('T')[0];
    } catch {
      return String(rawDate);
    }
  };

  return (
    <main className="flex min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      {/* Sidebar Navigation */}
      <aside
        className={`flex flex-col bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 border-r-2 border-[#d4af37] ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <header className="flex h-20 items-center justify-between px-4 border-b border-[#d4af37]/30">
          {!isSidebarCollapsed && (
            <h1 className="text-xl font-bold tracking-wider text-[#e6c687]">UniLogs</h1>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="rounded-md p-2 text-[#e6c687] hover:bg-[#2a150a] focus:outline-none cursor-pointer"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </header>

        <nav className="flex-1 p-4">
          <ul className="flex flex-col gap-2">
            <li>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] hover:bg-[#2a150a] transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                {!isSidebarCollapsed && <span>Dashboard</span>}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] hover:bg-[#2a150a] transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                {!isSidebarCollapsed && <span>Projects</span>}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md bg-[#d4a373] p-3 font-semibold text-[#1c0d06] cursor-pointer"
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {!isSidebarCollapsed && <span>All Entries</span>}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] hover:bg-[#2a150a] transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {!isSidebarCollapsed && <span>Profile information</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content Workspace */}
      <section className="flex flex-1 flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="flex h-20 items-center justify-between border-b-2 border-[#d4af37] bg-[#1c0d06] px-8 text-[#f5ebe0] shadow-md">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#e6c687]">All Log Entries</h2>
          <article className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
              {userInitial}
            </span>
          </article>
        </header>

        {/* Entries Workspace */}
        <section className="flex flex-1 flex-col items-center justify-start p-6 md:p-12">
          <section className="flex w-full max-w-4xl flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-[#1c0d06] border-b border-[#d4a373]/40 pb-2">
                Logged Entries ({entries.length})
              </h3>

              {isLoading ? (
                <div className="p-6 text-center text-sm font-semibold text-[#7a5230]">
                  Loading log entries...
                </div>
              ) : !hasUserEntries ? (
                /* 4 Empty Placeholders when NO entries exist */
                Array.from({ length: 4 }).map((_, index) => (
                  <article
                    key={`entry_placeholder_${index}`}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-[#d4a373] bg-white/70 p-6 opacity-75 shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold text-[#1c0d06] opacity-60">
                        [Entry Summary / Activity]
                      </span>
                      <span className="text-xs font-semibold text-[#7a5230]">
                        Project: [Associated Project] • Category: [General]
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a5230]">
                          [Logged Date]
                        </span>
                        <span className="rounded border border-[#d4a373] bg-[#f5ebe0] px-3 py-1.5 text-xs font-bold text-[#1c0d06] opacity-60">
                          YYYY-MM-DD
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                /* Render actual user log entries */
                entries.map((entry) => {
                  const projectName = resolveProjectName(entry);
                  const entrySummary = resolveEntrySummary(entry);
                  const formattedDate = resolveFormattedDate(entry);

                  return (
                    <article
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#d4a373] bg-white p-6 shadow-md transition-transform hover:scale-[1.01] cursor-pointer"
                    >
                      <div className="flex flex-col gap-1 max-w-lg">
                        <h4 className="text-lg font-bold text-[#1c0d06]">{entrySummary}</h4>
                        <span className="text-xs font-semibold text-[#7a5230]">
                          Project: <span className="underline">{projectName}</span>
                          {entry.category && ` • Category: ${entry.category}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a5230]">
                            {entry.hours ? `${entry.hours} hrs` : 'LOGGED'}
                          </span>
                          <span className="rounded border border-[#d4a373] bg-[#f5ebe0] px-3 py-1.5 text-xs font-bold text-[#1c0d06]">
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </section>

      {/* Pop-Up Modal for Viewing Detailed Entry Info */}
      {selectedEntry && (
        <aside
          onClick={() => setSelectedEntry(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <article
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border-2 border-[#d4a373] bg-[#f5ebe0] p-6 shadow-2xl text-[#1c0d06]"
          >
            <header className="flex items-center justify-between border-b border-[#d4a373]/40 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#7a5230]">
                  Log Entry Details
                </span>
                <h3 className="text-xl font-bold text-[#1c0d06] mt-1">
                  {resolveEntrySummary(selectedEntry)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="text-lg font-bold text-[#1c0d06] hover:text-[#7a5230] cursor-pointer"
              >
                ✕
              </button>
            </header>

            <section className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-white p-3 border border-[#d4a373]/30">
                  <span className="font-bold text-[#7a5230] block">Project</span>
                  <span className="text-[#1c0d06] font-semibold">
                    {resolveProjectName(selectedEntry)}
                  </span>
                </div>

                <div className="rounded-md bg-white p-3 border border-[#d4a373]/30">
                  <span className="font-bold text-[#7a5230] block">Date & Duration</span>
                  <span className="text-[#1c0d06] font-semibold">
                    {resolveFormattedDate(selectedEntry)}{' '}
                    {selectedEntry.hours ? `(${selectedEntry.hours} hrs)` : ''}
                  </span>
                </div>
              </div>

              {selectedEntry.category && (
                <div className="rounded-md bg-white p-3 text-xs border border-[#d4a373]/30">
                  <span className="font-bold text-[#7a5230]">Category: </span>
                  <span className="font-semibold text-[#1c0d06]">{selectedEntry.category}</span>
                </div>
              )}

              {(selectedEntry.details || selectedEntry.content) && (
                <div className="rounded-md bg-white p-4 text-xs text-[#1c0d06] border border-[#d4a373]/30 flex flex-col gap-1">
                  <span className="font-bold text-[#7a5230]">Additional Notes / Details:</span>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedEntry.details ||
                      (typeof selectedEntry.content === 'string'
                        ? selectedEntry.content
                        : JSON.stringify(selectedEntry.content, null, 2))}
                  </p>
                </div>
              )}
            </section>

            <footer className="mt-6 flex justify-end border-t border-[#d4a373]/40 pt-4">
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="rounded-md bg-[#1c0d06] px-5 py-2 text-xs font-bold text-[#f5ebe0] hover:bg-[#d4a373] hover:text-[#1c0d06] transition-colors cursor-pointer"
              >
                Close
              </button>
            </footer>
          </article>
        </aside>
      )}
    </main>
  );
};

export default EntriesPage;
