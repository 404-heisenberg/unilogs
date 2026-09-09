import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Entries</h1>
        <Link to="/entries/new">
          <Button className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">New Entry</Button>
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
          Failed to load entries. Try refreshing the page.
        </div>
      )}

      {entries?.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">No entries yet.</p>
          <Link to="/entries/new">
            <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
              Log your first entry
            </Button>
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {(entries ?? []).map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-[#7a5230]">{entry.date.slice(0, 10)}</p>
            <dl className="mt-1 flex flex-col gap-0.5">
              {Object.entries(entry.content).map(([name, value]) => (
                <div key={name} className="flex gap-2 text-sm">
                  <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                  <dd className="text-[#4a3525]">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
