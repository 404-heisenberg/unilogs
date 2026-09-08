import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, api } from '../lib/api';

export type ProjectStatus = 'In-Progress' | 'Pending' | 'Done';

export interface LogEntry {
  id: string;
  date: string;
  summary: string;
  category?: string;
  hours?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  status: ProjectStatus;
  isArchived: boolean;
  entries?: LogEntry[];
}

export const ProjectsPage: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

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

  // Load projects from backend API
  useEffect(() => {
    setIsLoading(true);
    api
      .get<ProjectItem[]>('/api/projects')
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load projects from server:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, projectId: string) => {
    e.stopPropagation();
    const newStatus = e.target.value as ProjectStatus;

    setProjects((prev) =>
      prev.map((proj) => (proj.id === projectId ? { ...proj, status: newStatus } : proj)),
    );

    try {
      await api.post(`/api/projects/${projectId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
  };

  const handleArchiveProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();

    setProjects((prev) =>
      prev.map((proj) => (proj.id === projectId ? { ...proj, isArchived: true } : proj)),
    );

    try {
      await api.post(`/api/projects/${projectId}/archive`, { isArchived: true });
    } catch (err) {
      console.error('Failed to archive project on server:', err);
    }
  };

  const activeProjects = projects.filter((p) => !p.isArchived);
  const archivedProjects = projects.filter((p) => p.isArchived);

  // Check if ANY user projects exist in state/database
  const hasUserProjects = projects.length > 0;

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
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                {!isSidebarCollapsed && <span>Projects</span>}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('/entries')}
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
          <h2 className="text-3xl font-extrabold tracking-tight text-[#e6c687]">Projects</h2>
          <article className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
              {userInitial}
            </span>
          </article>
        </header>

        {/* Project List Workspace */}
        <section className="flex flex-1 flex-col items-center justify-start p-6 md:p-12">
          <section className="flex w-full max-w-4xl flex-col gap-6">
            {/* Active Projects List */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-[#1c0d06] border-b border-[#d4a373]/40 pb-2">
                Active Projects ({activeProjects.length})
              </h3>

              {isLoading ? (
                <div className="p-6 text-center text-sm font-semibold text-[#7a5230]">
                  Loading projects...
                </div>
              ) : !hasUserProjects ? (
                /* 4 Active Placeholders when NO user projects exist at all */
                Array.from({ length: 4 }).map((_, index) => (
                  <article
                    key={`active_placeholder_${index}`}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-[#d4a373] bg-white/70 p-6 opacity-75 shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold text-[#1c0d06] opacity-60">
                        [Project Details]
                      </span>
                      <span className="text-xs font-semibold text-[#7a5230]">[Entries]</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a5230]">
                          [project status]
                        </span>
                        <select
                          disabled
                          className="rounded border border-[#d4a373] bg-[#f5ebe0] px-3 py-1.5 text-xs font-bold text-[#1c0d06] cursor-not-allowed opacity-60"
                        >
                          <option>In-Progress</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled
                        className="rounded bg-gray-300 px-4 py-2 text-xs font-bold text-gray-500 cursor-not-allowed"
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                /* Render actual user active projects */
                activeProjects.map((project) => {
                  const isDone = project.status === 'Done';
                  return (
                    <article
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#d4a373] bg-white p-6 shadow-md transition-transform hover:scale-[1.01] cursor-pointer"
                    >
                      <div className="flex flex-col gap-1">
                        <h4 className="text-xl font-bold text-[#1c0d06]">{project.name}</h4>
                        <span className="text-xs font-semibold text-[#7a5230]">
                          Created: {project.createdAt || 'N/A'} • [{project.entries?.length || 0}{' '}
                          Log Entries]
                        </span>
                        {project.description && (
                          <p className="mt-1 text-xs text-[#1c0d06]/80 line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div
                          className="flex flex-col items-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a5230]">
                            [project status]
                          </span>
                          <select
                            value={project.status}
                            onChange={(e) => handleStatusChange(e, project.id)}
                            className="rounded border border-[#d4a373] bg-[#f5ebe0] px-3 py-1.5 text-xs font-bold text-[#1c0d06] focus:outline-none cursor-pointer"
                          >
                            <option value="In-Progress">In-Progress</option>
                            <option value="Pending">Pending</option>
                            <option value="Done">Done</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={!isDone}
                          onClick={(e) => handleArchiveProject(e, project.id)}
                          className={`rounded px-4 py-2 text-xs font-bold transition-colors ${
                            isDone
                              ? 'bg-[#1c0d06] text-[#f5ebe0] hover:bg-[#d4a373] hover:text-[#1c0d06] cursor-pointer'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                          }`}
                          title={isDone ? 'Archive Project' : 'Set status to "Done" to archive'}
                        >
                          Archive
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* Archived Projects Section */}
            {(!hasUserProjects || archivedProjects.length > 0) && (
              <div className="mt-8 flex flex-col gap-4">
                <h3 className="text-xl font-bold text-[#7a5230] border-b border-[#d4a373]/40 pb-2">
                  Archived Logs ({archivedProjects.length})
                </h3>

                {!hasUserProjects
                  ? /* 4 Archived Placeholders when NO user projects exist at all */
                    Array.from({ length: 4 }).map((_, index) => (
                      <article
                        key={`archived_placeholder_${index}`}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-gray-400 bg-gray-100/60 p-6 opacity-60 shadow-sm"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-lg font-bold text-gray-600 line-through">
                            [Archived Project Details]
                          </span>
                          <span className="text-xs font-semibold text-gray-500">
                            [Archived • 0 Entries]
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded bg-gray-200 px-3 py-1 text-xs font-bold text-gray-500">
                            Archived (Read-Only)
                          </span>
                        </div>
                      </article>
                    ))
                  : /* Render actual user archived projects */
                    archivedProjects.map((project) => (
                      <article
                        key={project.id}
                        onClick={() => setSelectedProject(project)}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-300 bg-gray-100 p-6 shadow-sm opacity-80 cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <h4 className="text-xl font-bold text-gray-700 line-through">
                            {project.name}
                          </h4>
                          <span className="text-xs font-semibold text-gray-500">
                            Archived • [{project.entries?.length || 0} Log Entries]
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="rounded bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600">
                            Archived (Read-Only)
                          </span>
                        </div>
                      </article>
                    ))}
              </div>
            )}
          </section>
        </section>
      </section>

      {/* Pop-Up Modal for Viewing Detailed Project Logs */}
      {selectedProject && (
        <aside
          onClick={() => setSelectedProject(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <article
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border-2 border-[#d4a373] bg-[#f5ebe0] p-6 shadow-2xl text-[#1c0d06]"
          >
            <header className="flex items-center justify-between border-b border-[#d4a373]/40 pb-3">
              <div>
                <h3 className="text-2xl font-bold text-[#1c0d06]">{selectedProject.name}</h3>
                <span className="text-xs font-semibold text-[#7a5230]">
                  Status: {selectedProject.status} {selectedProject.isArchived ? '(Archived)' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="text-lg font-bold text-[#1c0d06] hover:text-[#7a5230] cursor-pointer"
              >
                ✕
              </button>
            </header>

            <section className="mt-4 flex flex-col gap-4">
              {selectedProject.description && (
                <div className="rounded-md bg-white p-3 text-xs text-[#1c0d06] border border-[#d4a373]/30">
                  <span className="font-bold">Description: </span>
                  {selectedProject.description}
                </div>
              )}

              <h4 className="text-sm font-bold uppercase tracking-wide text-[#7a5230]">
                Associated Log Entries ({selectedProject.entries?.length || 0})
              </h4>

              {!selectedProject.entries || selectedProject.entries.length === 0 ? (
                <p className="text-xs font-semibold text-[#7a5230] italic">
                  No detailed log entries registered under this project yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {selectedProject.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-[#d4a373] bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#7a5230]">
                        <span>Date: {entry.date}</span>
                        {entry.hours && <span>{entry.hours} hrs</span>}
                      </div>
                      <p className="mt-2 text-sm text-[#1c0d06] font-medium">{entry.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <footer className="mt-6 flex justify-end border-t border-[#d4a373]/40 pt-4">
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="rounded-md bg-[#1c0d06] px-5 py-2 text-xs font-bold text-[#f5ebe0] hover:bg-[#d4a373] hover:text-[#1c0d06] transition-colors cursor-pointer"
              >
                Close (Click Outside to Exit)
              </button>
            </footer>
          </article>
        </aside>
      )}
    </main>
  );
};

export default ProjectsPage;
