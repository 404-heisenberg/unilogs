import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Project } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Folder,
  FileText,
  User as UserIcon,
  LogOut,
  Plus,
  Check,
  X,
} from 'lucide-react';

type SaveInput = { name: string; description: string | null };

// --- Sub-Component: Inline Editable Project Row ---
function ProjectRow({
  project,
  archivedView,
  onSave,
  onArchiveToggle,
  isSaving,
  isTogglingArchive,
}: {
  project: Project;
  archivedView: boolean;
  onSave: (input: SaveInput) => void;
  onArchiveToggle: () => void;
  isSaving: boolean;
  isTogglingArchive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');

  const cancel = () => {
    setEditing(false);
    setName(project.name);
    setDescription(project.description ?? '');
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-3 rounded-xl border border-[#d4af37]/40 bg-white p-4 shadow-sm transition-all">
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Project name"
            placeholder="Project name"
            className="rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Project description"
            className="rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={cancel}
            disabled={isSaving}
            className="border-[#d4a373]/60 text-[#1c0d06] hover:bg-[#f5ebe0]"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isSaving || !name.trim()}
            onClick={() => {
              onSave({ name: name.trim(), description: description.trim() || null });
              setEditing(false);
            }}
            className="bg-[#1c0d06] text-[#f5ebe0] hover:bg-[#1c0d06]/90 border border-[#d4af37]/30"
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-[#d4af37]/30 bg-white p-4 shadow-sm transition-all hover:border-[#d4af37]/60 hover:shadow-md">
      <Link to={`/projects/${project.id}`} className="group min-w-0 flex-1">
        <p className="font-semibold text-[#1c0d06] transition-colors group-hover:text-[#7a5230]">
          {project.name}
        </p>
        {project.description ? (
          <p className="mt-1 text-sm text-[#7a5230] line-clamp-2">{project.description}</p>
        ) : (
          <p className="mt-1 text-xs italic text-[#7a5230]/60">No description provided</p>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {!archivedView && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="border-[#d4a373]/50 text-[#1c0d06] hover:bg-[#f5ebe0]"
          >
            Edit
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onArchiveToggle}
          disabled={isTogglingArchive}
          className="border-[#d4a373]/50 text-[#7a5230] hover:bg-[#f5ebe0] hover:text-[#1c0d06]"
        >
          {archivedView ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
    </li>
  );
}

// --- Main Page Component ---
export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Layout & UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [archivedView, setArchivedView] = useState(false);

  // User Profile Fallbacks
  const userName = 'Student User';
  const userInitial = userName.charAt(0).toUpperCase();

  // --- TanStack Query Integration ---
  const {
    data: projects,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['projects', { archived: archivedView }],
    queryFn: () => api.get<Project[]>(`/api/projects${archivedView ? '?archived=true' : ''}`),
  });

  const invalidateProjects = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const updateProject = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & SaveInput) =>
      api.patch<Project>(`/api/projects/${id}`, data),
    onSuccess: invalidateProjects,
  });

  const archiveToggle = useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) =>
      api.post<Project>(`/api/projects/${id}/${archived ? 'unarchive' : 'archive'}`),
    onSuccess: invalidateProjects,
  });

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const mutationError = updateProject.error ?? archiveToggle.error;

  return (
    <div className="flex min-h-screen bg-[#f5ebe0]">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <aside
        className={`relative flex flex-col justify-between border-r border-[#d4af37]/40 bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          {/* Sidebar Header & Toggle */}
          <div className="flex h-16 items-center justify-between border-b border-[#d4af37]/30 px-4">
            {!isSidebarCollapsed && (
              <span className="text-xl font-bold tracking-wider text-[#d4af37]">UNILOGS</span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="rounded-lg p-1.5 text-[#d4af37] hover:bg-[#d4af37]/10"
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Navigation Buttons */}
          <nav className="mt-6 flex flex-col gap-1 px-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <LayoutDashboard size={18} />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </Link>

            <Link
              to="/projects"
              className="flex items-center gap-3 rounded-lg bg-[#d4af37]/20 px-3 py-2.5 text-sm font-medium text-[#d4af37]"
            >
              <Folder size={18} />
              {!isSidebarCollapsed && <span>Projects</span>}
            </Link>

            <Link
              to="/entries"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <FileText size={18} />
              {!isSidebarCollapsed && <span>All Entries</span>}
            </Link>

            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <UserIcon size={18} />
              {!isSidebarCollapsed && <span>Profile</span>}
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer / Sign Out */}
        <div className="border-t border-[#d4af37]/30 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT AREA */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* TOP BANNER / HEADER */}
        <header className="flex h-16 items-center justify-between border-b border-[#d4af37]/30 bg-white px-8 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-[#1c0d06]">Projects</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#7a5230]">{userName}</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c0d06] text-sm font-bold text-[#d4af37]">
              {userInitial}
            </div>
          </div>
        </header>

        {/* MAIN PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-5xl">
            {/* Header Title & Main Action */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
                  {archivedView ? 'Archived Projects' : 'Projects'}
                </h1>
              </div>
              <Link to="/projects/new">
                <Button className="bg-[#1c0d06] text-[#f5ebe0] shadow-sm hover:bg-[#1c0d06]/90 border border-[#d4af37]/30">
                  <Plus className="mr-1.5 h-4 w-4 text-[#d4af37]" /> New Project
                </Button>
              </Link>
            </div>

            {/* View Toggle Link */}
            <div className="mb-6">
              <button
                onClick={() => setArchivedView((v) => !v)}
                className="text-sm font-medium text-[#7a5230] underline hover:text-[#1c0d06] transition-colors"
              >
                {archivedView ? '← Back to active projects' : 'Show archived projects'}
              </button>
            </div>

            {/* Mutation Error Banner */}
            {mutationError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 shadow-sm">
                {mutationError.message}
              </div>
            )}

            {/* Loading Skeletons */}
            {isPending && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-[#d4a373]/20 border border-[#d4a373]/30"
                  />
                ))}
              </div>
            )}

            {/* Query Error State */}
            {isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                Failed to load projects. Try refreshing the page.
              </div>
            )}

            {/* Contextual Empty States */}
            {!isPending &&
              projects?.length === 0 &&
              (archivedView ? (
                <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/50 p-12 text-center shadow-sm">
                  <p className="text-base font-medium text-[#1c0d06]">No archived projects.</p>
                  <p className="mt-1 text-sm text-[#7a5230]">
                    Projects you archive will appear here.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/50 p-12 text-center shadow-sm">
                  <p className="text-base font-medium text-[#1c0d06]">No projects yet.</p>
                  <p className="mt-1 text-sm text-[#7a5230]">
                    Get started by creating your first project.
                  </p>
                  <Link to="/projects/new">
                    <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] shadow-sm hover:bg-[#1c0d06]/90 border border-[#d4af37]/30">
                      Create your first project
                    </Button>
                  </Link>
                </div>
              ))}

            {/* Project Row List */}
            <ul className="flex flex-col gap-3">
              {(projects ?? []).map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  archivedView={archivedView}
                  onSave={(input) => updateProject.mutate({ id: project.id, ...input })}
                  onArchiveToggle={() =>
                    archiveToggle.mutate({ id: project.id, archived: project.archived })
                  }
                  isSaving={updateProject.isPending && updateProject.variables?.id === project.id}
                  isTogglingArchive={
                    archiveToggle.isPending && archiveToggle.variables?.id === project.id
                  }
                />
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
