import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      {isPending && <p className="text-sm text-slate-500">Loading projects…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load projects.</p>}
      {projects?.length === 0 && (
        <p className="text-sm text-slate-500">
          No projects yet. Create your first one to start logging.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {(projects ?? []).map((project) => (
          <li key={project.id} className="border rounded-lg p-4">
            <Link to={`/projects/${project.id}`} className="font-semibold hover:underline">
              {project.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
