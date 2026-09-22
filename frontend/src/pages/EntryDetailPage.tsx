import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import EntryEditSheet from '@/components/entries/EntryEditSheet';
import { api, ApiError } from '@/lib/api';
import type { Entry } from '@/types';

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const [editOpen, setEditOpen] = useState(false);

  const {
    data: entry,
    isPending,
    error,
    isError,
  } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => api.get<Entry>(`/api/entries/${entryId}`),
    enabled: !!entryId,
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div>
      <Link
        to="/entries"
        className="inline-block -my-3 py-3 text-sm text-[#7a5230] hover:text-[#1c0d06]"
      >
        &larr; Timeline
      </Link>

      {isPending && (
        <div className="mt-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#d4a373]/20" />
          ))}
        </div>
      )}

      {notFound && (
        <div className="mt-4 rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">
            This entry doesn&apos;t exist, or it isn&apos;t yours.
          </p>
          <Link
            to="/entries"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#1c0d06] px-4 py-2 text-sm font-semibold text-[#f5ebe0] hover:opacity-90"
          >
            Back to timeline
          </Link>
        </div>
      )}

      {isError && !notFound && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load this entry. Try refreshing the page.
        </div>
      )}

      {entry && (
        <article className="mt-2">
          <div className="mb-6 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-[#7a5230] uppercase">
                {entry.project?.name ?? 'Entry'}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
                {entry.title ?? 'Entry'}
              </h1>
              <p className="mt-1 text-sm text-[#7a5230]">{entry.date.slice(0, 10)}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit properties"
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-[#d4a373]/50 px-3 text-sm font-medium text-[#1c0d06] hover:bg-[#f5ebe0]"
            >
              <Pencil size={14} strokeWidth={1.75} />
              Edit
            </button>
          </div>

          {entry.body && (
            <p className="mb-4 text-sm whitespace-pre-wrap text-[#4a3525]">{entry.body}</p>
          )}

          {Object.keys(entry.content).length > 0 && (
            <dl className="flex flex-col gap-2 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm">
              {Object.entries(entry.content).map(([name, value]) => (
                <div key={name} className="flex flex-wrap gap-2 text-sm">
                  <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                  <dd className="text-[#4a3525]">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-[#d4a373]/20 px-3 py-1 text-xs font-medium text-[#7a5230]"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-[#7a5230]">
            Logged {new Date(entry.createdAt).toLocaleString()}
          </p>

          <EntryEditSheet entry={entry} open={editOpen} onOpenChange={setEditOpen} />
        </article>
      )}
    </div>
  );
}
