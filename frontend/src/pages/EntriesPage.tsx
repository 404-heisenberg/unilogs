import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Entry } from '@/types';

export default function EntriesPage() {
  const {
    data: entries,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['entries'],
    queryFn: () => api.get<Entry[]>('/api/entries'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Entries</h1>
      {isPending && <p className="text-sm text-slate-500">Loading entries…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load entries.</p>}
      {entries?.length === 0 && (
        <p className="text-sm text-slate-500">No entries yet. Log your first work session.</p>
      )}
      <ul className="flex flex-col gap-3">
        {(entries ?? []).map((entry) => (
          <li key={entry.id} className="border rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{entry.date.slice(0, 10)}</span>
              <span>{entry.content.timeSpent}</span>
            </div>
            <p className="mt-1">{entry.content.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
