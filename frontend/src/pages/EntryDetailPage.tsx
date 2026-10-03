import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MoreHorizontal, Trash2, CalendarCheck } from 'lucide-react';
import PaneLayout, { PANE_LABEL } from '@/components/PaneLayout';
import Skeleton from '@/components/Skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { projectColor, tagStyle } from '@/lib/colors';
import { entryDurationHours, formatDurationHours } from '@/lib/project-workspace';
import type { Entry, FieldDefinition } from '@/types';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFieldValue(value: unknown, fieldType: string | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (fieldType === 'duration' && typeof value === 'number') return formatDurationHours(value);
  if (fieldType === 'date' && typeof value === 'string') return formatDate(value);
  return String(value);
}

function PropertyRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="min-w-0 truncate text-clay">{label}</span>
      <span className="min-w-0 truncate text-right text-espresso">{children}</span>
    </div>
  );
}

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Field types, so durations read "2h 30m" and dates are formatted.
  const projectId = entry ? String(entry.projectId) : undefined;
  const { data: fields = [] } = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const deleteEntry = useMutation({
    mutationFn: () => api.delete(`/api/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteConfirm) navigate('/entries');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, showDeleteConfirm]);

  const notFound = isError && error instanceof ApiError && error.status === 404;

  if (!entry) {
    return (
      <div>
        {isPending && <Skeleton rows={3} barClassName="h-16 rounded-xl" className="gap-3" />}
        {notFound && (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
            <p className="text-sm text-cocoa">
              This entry doesn&apos;t exist, or it isn&apos;t yours.
            </p>
            <Link
              to="/entries"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-espresso px-5 text-sm font-semibold text-cream transition-opacity hover:opacity-90 md:min-h-10"
            >
              Back to timeline
            </Link>
          </div>
        )}
        {isError && !notFound && (
          <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
            Failed to load this entry. Try refreshing the page.
          </div>
        )}
      </div>
    );
  }

  const fieldTypes = new Map(fields.map((field) => [field.name, field.fieldType]));
  const contentEntries = Object.entries(entry.content ?? {});
  const contentRecord = (entry.content ?? {}) as Record<string, unknown>;
  const tags = entry.tags ?? [];
  const formattedDate = formatDate(entry.date);
  const formattedDueDate = entry.dueDate ? formatDate(entry.dueDate) : null;
  const hours = fields.length > 0 ? entryDurationHours(entry, fields) : null;
  const projectName = entry.project?.name;

  const properties = (
    <div className="flex flex-col gap-5">
      <h2 className={PANE_LABEL}>Properties</h2>
      <div className="flex flex-col gap-3">
        <PropertyRow
          label={
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: projectColor(entry.projectId) }}
                aria-hidden
              />
              Project
            </span>
          }
        >
          {projectName ?? '—'}
        </PropertyRow>
        <PropertyRow label="Date">{formattedDate || '—'}</PropertyRow>
        {formattedDueDate && (
          <PropertyRow
            label={
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="size-3.5" aria-hidden />
                Due date
              </span>
            }
          >
            {formattedDueDate}
          </PropertyRow>
        )}
      </div>
      {contentEntries.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-cream pt-5">
          <h3 className={PANE_LABEL}>Custom fields</h3>
          {contentEntries.map(([name, value]) => (
            <PropertyRow key={name} label={name}>
              {formatFieldValue(value, fieldTypes.get(name))}
            </PropertyRow>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <PaneLayout pane={properties} paneLabel="Entry properties">
      {/* Figma's thin top bar: breadcrumb, Edit and the overflow menu. */}
      <div className="-mx-4 -mt-4 mb-6 flex min-h-12 items-center justify-between gap-3 border-b border-cream px-4 md:-mx-12 md:-mt-12 md:mb-10 md:px-12">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link
            to={`/projects/${entry.projectId}`}
            className="truncate font-medium text-gold hover:underline"
          >
            {projectName ?? 'Project'}
          </Link>
          <span className="text-clay">/</span>
          <span className="truncate text-cocoa">{entry.title ?? 'Entry'}</span>
        </nav>
        <div className="relative flex shrink-0 items-center gap-2">
          <Link
            to={`/entries/${entryId}/history`}
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-[13px] font-semibold text-espresso transition-colors hover:bg-cream md:min-h-8"
          >
            History
          </Link>
          <Link
            to={`/entries/${entryId}/edit`}
            className="inline-flex min-h-11 items-center rounded-lg bg-espresso px-4 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 md:min-h-8"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex size-11 items-center justify-center rounded-md text-clay transition-colors hover:bg-cream hover:text-espresso md:size-8"
            aria-label="More options"
            aria-expanded={isMenuOpen}
          >
            <MoreHorizontal size={18} />
          </button>
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute top-full right-0 z-30 mt-2 w-44 rounded-lg border border-line bg-paper py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] font-medium text-danger-text transition-colors hover:bg-danger-soft"
                >
                  <Trash2 size={14} />
                  Delete entry
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <article className="flex flex-col gap-6 pb-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-[26px] font-bold text-espresso">{entry.title ?? 'Entry'}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-clay">
            {projectName && (
              <>
                <span>{projectName}</span>
                <span aria-hidden>•</span>
              </>
            )}
            <span>{formattedDate}</span>
            {hours !== null && hours > 0 && (
              <>
                <span aria-hidden>•</span>
                <span>{formatDurationHours(hours)}</span>
              </>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tagStyle(tag.name)}`}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {entry.body ? (
          <div className="prose prose-sm max-w-none leading-relaxed text-espresso prose-headings:text-espresso prose-p:text-espresso prose-a:text-clay prose-strong:text-espresso prose-blockquote:border-gold prose-blockquote:text-cocoa">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
          </div>
        ) : contentRecord['Notes'] ? (
          <div className="text-sm whitespace-pre-wrap text-espresso">
            {String(contentRecord['Notes'])}
          </div>
        ) : (
          <p className="text-sm text-clay italic">No notes</p>
        )}

        <p className="border-t border-cream pt-4 text-xs text-clay">
          Logged {new Date(entry.createdAt).toLocaleString()}
        </p>
      </article>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Delete entry</DialogTitle>
          <DialogDescription>
            This permanently deletes “{entry.title ?? 'this entry'}”. This cannot be undone.
          </DialogDescription>
          <DialogFooter className="gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteEntry.isPending}
              className="min-h-11 rounded-lg border border-line px-5 text-sm font-medium text-espresso transition-colors hover:bg-cream md:min-h-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteEntry.mutate()}
              disabled={deleteEntry.isPending}
              className="min-h-11 rounded-lg bg-danger px-5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50 md:min-h-10"
            >
              {deleteEntry.isPending ? 'Deleting…' : 'Delete entry'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneLayout>
  );
}
