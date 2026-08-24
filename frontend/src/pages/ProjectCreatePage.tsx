import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Project } from '@/types';

export default function ProjectCreatePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: (input: { name: string }) => api.post<Project>('/api/projects', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createProject.mutate({ name });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New Project</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm mb-1">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gym"
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project for?"
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        {createProject.isError && (
          <p className="text-sm text-red-700">{createProject.error.message}</p>
        )}

        <Button type="submit" disabled={createProject.isPending}>
          {createProject.isPending ? 'Saving…' : 'Save project'}
        </Button>
      </form>
    </div>
  );
}
