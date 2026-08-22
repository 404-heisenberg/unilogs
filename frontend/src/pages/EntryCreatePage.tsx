import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function EntryCreatePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !timeSpent) return;

    // will be replaced with real API call once backend + #21 wrappers are ready
    console.log('New entry:', { date, description, timeSpent });

    setDescription('');
    setTimeSpent('');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New Entry</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
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

        <Button type="submit">Save entry</Button>
      </form>
    </div>
  );
}
