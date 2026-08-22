import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ProjectCreatePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    //we will  replace with real API call once backend + #21 wrappers are ready
    console.log('New project:', { name, description });

    setName('');
    setDescription('');
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

        <Button type="submit">Save project</Button>
      </form>
    </div>
  );
}
