import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import type { Entry } from '@/types';

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();

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
      <Link to="/entries" className="text-sm text-[#7a5230] hover:text-[#1c0d06]">
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
            className="mt-4 inline-block rounded-md bg-[#1c0d06] px-4 py-2 text-sm font-semibold text-[#f5ebe0] hover:opacity-90"
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
          <div className="mb-6 flex items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
              {entry.project?.name ?? 'Entry'}
            </h1>
            <p className="text-sm text-[#7a5230]">{entry.date ? entry.date.slice(0, 10) : ''}</p>
          </div>

          <dl className="flex flex-col gap-2 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm">
            {entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content) ? (
              Object.entries(entry.content as Record<string, unknown>).map(([name, value]) => (
                <div key={name} className="flex flex-wrap gap-2 text-sm">
                  <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                  <dd className="text-[#4a3525]">{String(value)}</dd>
                </div>
              ))
            ) : (
              <p className="text-sm italic text-[#7a5230]/60">No content logged</p>
            )}
          </dl>

          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.tags.map((item, idx) => {
                const tagObj =
                  typeof item === 'object' && item !== null && 'tag' in item
                    ? (item as { tag: { id?: string | number; name?: string } }).tag
                    : item;

                const tagKey =
                  typeof tagObj === 'object' && tagObj !== null && 'id' in tagObj && tagObj.id
                    ? tagObj.id
                    : idx;

                const tagName =
                  typeof tagObj === 'object' && tagObj !== null && 'name' in tagObj
                    ? tagObj.name
                    : String(tagObj);

                return (
                  <span
                    key={tagKey}
                    className="rounded-full bg-[#d4a373]/20 px-3 py-1 text-xs font-medium text-[#7a5230]"
                  >
                    {tagName}
                  </span>
                );
              })}
            </div>
          )}

          {entry.createdAt && (
            <p className="mt-4 text-xs text-[#7a5230]">
              Logged {new Date(entry.createdAt).toLocaleString()}
            </p>
          )}
        </article>
      )}
    </div>
  );
}
