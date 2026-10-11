import { Link } from 'react-router-dom';
import { Clock, SquareCheck } from 'lucide-react';
import { projectColor, tagStyle } from '@/lib/colors';
import FieldValues from '@/components/entries/FieldValues';
import { entryFieldPairs, type FieldShape } from '@/lib/entryFields';
import { formatShortDate } from '@/lib/project-workspace';
import { stripMarkdownLine } from '@/lib/sharedReport';
import type { Entry } from '@/types';

// What a timeline card needs. `createdAt` is optional because the as-at view
// renders reconstructed entries, which carry no creation time.
export type TimelineEntry = Pick<Entry, 'id' | 'projectId' | 'title' | 'body' | 'content'> & {
  createdAt?: string;
  tags?: Entry['tags'];
};

export type DueInfo = { overdue: boolean; dueDate: string | null };

function markdownSnippet(body: string | null | undefined): string | null {
  if (!body) return null;
  const firstLine = body
    .split('\n')
    .map(stripMarkdownLine)
    .find((line) => line !== '');
  return firstLine ?? null;
}

function entryHeadline(
  entry: TimelineEntry,
  pairs: { name: string; text: string }[],
): { headline: string; snippet: string | null; showFields: boolean } {
  if (entry.title) {
    return { headline: entry.title, snippet: markdownSnippet(entry.body), showFields: true };
  }
  // Untitled: the field values are the headline, so they aren't listed twice.
  const fromFields = pairs.map(({ name, text }) => `${name}: ${text}`).join(' · ');
  return {
    headline: fromFields || 'Untitled entry',
    snippet: markdownSnippet(entry.body),
    showFields: false,
  };
}

export default function EntryCard({
  entry,
  projectName,
  due,
  wide,
  readOnly = false,
  fields,
}: {
  entry: TimelineEntry;
  projectName: string;
  /** The project's field names and types, for formatting values. */
  fields?: FieldShape[];
  due?: DueInfo;
  wide: boolean;
  /** No links into the entry or project: the card shows a past state. */
  readOnly?: boolean;
}) {
  const pairs = entryFieldPairs(entry.content as Record<string, unknown>, fields);
  const { headline, snippet, showFields } = entryHeadline(entry, pairs);
  const tags = entry.tags ?? [];
  const dueLabel = due?.dueDate ? formatShortDate(due.dueDate.slice(0, 10)) : null;

  const projectLabel = (
    <>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: projectColor(entry.projectId) }}
        aria-hidden
      />
      <span className="truncate">{projectName}</span>
    </>
  );

  return (
    <li
      className={`relative flex flex-col gap-3 rounded-xl border border-cream bg-paper p-4 ${
        readOnly ? '' : 'transition-shadow hover:shadow-md'
      } ${wide ? 'md:col-span-2' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        {readOnly ? (
          <p className="inline-flex min-w-0 items-center gap-2 text-[10px] font-bold tracking-[0.04em] text-clay uppercase">
            {projectLabel}
          </p>
        ) : (
          <Link
            to={`/projects/${entry.projectId}`}
            className="relative z-10 -my-3 inline-flex min-h-11 min-w-0 items-center gap-2 text-[10px] font-bold tracking-[0.04em] text-clay uppercase hover:underline md:min-h-0"
          >
            {projectLabel}
          </Link>
        )}
        {entry.createdAt && (
          <p className="shrink-0 text-xs text-clay">
            {new Date(entry.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {readOnly ? (
          <p className="text-base font-semibold text-espresso">{headline}</p>
        ) : (
          // The title link covers the card; the project link sits above it.
          <Link
            to={`/entries/${entry.id}`}
            className="text-base font-semibold text-espresso after:absolute after:inset-0 after:rounded-xl"
          >
            {headline}
          </Link>
        )}
        {snippet && <p className="line-clamp-2 text-sm text-cocoa">{snippet}</p>}
      </div>
      {showFields && <FieldValues pairs={pairs} />}
      {(due || tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-caramel/30 pt-3">
          {due?.overdue ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-error">
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
              Overdue{dueLabel ? ` · due ${dueLabel}` : ''}
            </span>
          ) : due ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-clay">
              <SquareCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
              {dueLabel ? `Due ${dueLabel}` : 'Open'}
            </span>
          ) : null}
          {tags.map(({ tag }) => (
            <span
              key={tag.id}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${tagStyle(tag.name)}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
