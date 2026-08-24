import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Entry, Project } from '@/types';

export default function EntryCreatePage() {
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const createEntry = useMutation({
    mutationFn: (input: {
      projectId: number;
      date: string;
      content: { description: string; timeSpent: string };
    }) => api.post<Entry>('/api/entries', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !description || !timeSpent) return;

    createEntry.mutate({
      projectId: Number(projectId),
      date,
      content: { description, timeSpent },
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New Entry</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded px-3 py-2 w-full bg-white"
            required
          >
            <option value="">Select a project…</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">What did you do?</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Built entry list view"
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Time spent</label>
          <input
            type="text"
            value={timeSpent}
            onChange={(e) => setTimeSpent(e.target.value)}
            placeholder="e.g. 2h"
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>

        {createEntry.isError && <p className="text-sm text-red-700">{createEntry.error.message}</p>}

        <Button type="submit" disabled={createEntry.isPending}>
          {createEntry.isPending ? 'Saving…' : 'Save entry'}
        </Button>
      </form>
    </div>
  );
}
