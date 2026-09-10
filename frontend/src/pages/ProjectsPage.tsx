import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Project } from '@/types';

type SaveInput = { name: string; description: string | null };

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
      <li className="flex flex-col gap-2 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Project name"
          className="rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          aria-label="Project description"
          className="rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isSaving || !name.trim()}
            onClick={() => {
              onSave({ name: name.trim(), description: description.trim() || null });
              setEditing(false);
            }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
        <p className="font-semibold text-[#1c0d06]">{project.name}</p>
        {project.description && (
          <p className="mt-1 text-sm text-[#7a5230]">{project.description}</p>
        )}
      </Link>
      <div className="flex shrink-0 gap-2">
        {!archivedView && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onArchiveToggle} disabled={isTogglingArchive}>
          {archivedView ? 'Unarchive' : 'Archive'}
        </Button>
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const [archivedView, setArchivedView] = useState(false);
  const queryClient = useQueryClient();

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

  const mutationError = updateProject.error ?? archiveToggle.error;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Link to="/projects/new">
          <Button className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">New Project</Button>
        </Link>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setArchivedView((v) => !v)}
          className="text-sm text-[#7a5230] underline hover:text-[#1c0d06]"
        >
          {archivedView ? '← Back to active projects' : 'Show archived projects'}
        </button>
      </div>

      {mutationError && <p className="mb-4 text-sm text-red-700">{mutationError.message}</p>}

      {isPending && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#d4a373]/20" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load projects. Try refreshing the page.
        </div>
      )}

      {projects?.length === 0 &&
        (archivedView ? (
          <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
            <p className="text-sm text-[#4a3525]">No archived projects.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
            <p className="text-sm text-[#4a3525]">No projects yet.</p>
            <Link to="/projects/new">
              <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
                Create your first project
              </Button>
            </Link>
          </div>
        ))}

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
  );
}
