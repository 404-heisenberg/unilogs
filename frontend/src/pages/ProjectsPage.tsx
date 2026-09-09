import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const {
    data: projects,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Link to="/projects/new">
          <Button className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">New Project</Button>
        </Link>
      </div>

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

      {projects?.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">No projects yet.</p>
          <Link to="/projects/new">
            <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
              Create your first project
            </Button>
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {(projects ?? []).map((project) => (
          <li key={project.id}>
            <Link
              to={`/projects/${project.id}`}
              className="block rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="font-semibold text-[#1c0d06]">{project.name}</p>
              {project.description && (
                <p className="mt-1 text-sm text-[#7a5230]">{project.description}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
