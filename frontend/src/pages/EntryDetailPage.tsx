import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  PanelRight,
  MoreHorizontal,
  Trash2,
  CalendarCheck,
  X,
  BookOpen,
  Code2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { Entry } from '@/types';

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

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobilePropertiesOpen, setIsMobilePropertiesOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'read' | 'preview'>('read');

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

  const deleteEntry = useMutation({
    mutationFn: () => api.delete(`/api/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
    },
  });

  const handleDelete = () => {
    deleteEntry.mutate();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (isMobilePropertiesOpen) {
          setIsMobilePropertiesOpen(false);
        } else {
          navigate('/entries');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, showDeleteConfirm, isMobilePropertiesOpen]);

  const notFound = isError && error instanceof ApiError && error.status === 404;

  const contentEntries = entry ? Object.entries(entry.content ?? {}) : [];
  const tags = entry?.tags ?? [];
  const formattedDate = entry ? formatDate(entry.date) : '';
  const formattedDueDate = entry?.dueDate ? formatDate(entry.dueDate) : null;

  const contentRecord = (entry?.content ?? {}) as Record<string, unknown>;
  const timeSpentValue = contentRecord['Time spent'] ?? contentRecord['timeSpent'];
  const timeSpentStr =
    timeSpentValue !== null && timeSpentValue !== undefined ? String(timeSpentValue) : '';

  return (
    <div className="w-full p-6 lg:p-8 min-h-full flex flex-col relative">
      {isPending && (
        <div className="mt-4 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-caramel/20" />
          ))}
        </div>
      )}

      {notFound && (
        <div className="mt-4 rounded-xl border border-dashed border-caramel/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-cocoa">
            This entry doesn&apos;t exist, or it isn&apos;t yours.
          </p>
          <Link
            to="/entries"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-espresso px-4 py-2 text-sm font-semibold text-cream hover:opacity-90 transition-opacity"
          >
            Back to timeline
          </Link>
        </div>
      )}

      {isError && !notFound && (
        <div className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
          Failed to load this entry. Try refreshing the page.
        </div>
      )}

      {entry && (
        <div className="space-y-6 flex-1 flex flex-col">
          <header className="flex items-center justify-between pb-4 border-b border-caramel/20 shrink-0">
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Link
                to="/entries"
                className="text-caramel hover:text-espresso font-medium transition-colors"
              >
                {entry.project?.name ?? 'Timeline'}
              </Link>
              <span className="text-caramel">/</span>
              <span className="text-espresso font-medium truncate max-w-xs sm:max-w-md lg:max-w-xl">
                {entry.title ?? 'Entry'}
              </span>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3 relative">
              <Link
                to={`/entries/${entryId}/edit`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-espresso px-3.5 py-1.5 text-xs font-medium text-cream hover:opacity-90 transition-opacity"
              >
                Edit
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="p-1.5 text-clay hover:text-espresso transition-colors rounded-md hover:bg-caramel/10"
                  aria-label="More options"
                >
                  <MoreHorizontal size={18} />
                </button>

                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 rounded-md bg-white shadow-lg border border-caramel/30 py-1 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-error hover:bg-danger-soft transition-colors text-left"
                      >
                        <Trash2 size={14} />
                        Delete entry
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobilePropertiesOpen(true)}
                className="p-1.5 text-clay hover:text-espresso transition-colors rounded-md hover:bg-caramel/10 lg:hidden"
                aria-label="Toggle properties panel"
              >
                <PanelRight size={18} />
              </button>
            </div>
          </header>
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch flex-1">
            {/* Left Main Content Area */}
            <article className="flex-1 min-w-0 space-y-6 pb-8">
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h1 className="text-3xl font-bold tracking-tight text-espresso">
                    {entry.title ?? 'Entry'}
                  </h1>
                  <div className="inline-flex items-center rounded-lg border border-caramel/30 bg-white/60 p-1 shadow-sm shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('read')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        viewMode === 'read'
                          ? 'bg-espresso text-cream shadow-sm'
                          : 'text-clay hover:text-espresso'
                      }`}
                    >
                      <BookOpen size={14} />
                      Read
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        viewMode === 'preview'
                          ? 'bg-espresso text-cream shadow-sm'
                          : 'text-clay hover:text-espresso'
                      }`}
                    >
                      <Code2 size={14} />
                      Preview
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-clay">
                  {entry.project?.name && (
                    <>
                      <span className="font-medium">{entry.project.name}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formattedDate}</span>
                  {timeSpentStr.trim() !== '' && (
                    <>
                      <span>•</span>
                      <span>{timeSpentStr}</span>
                    </>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map((t, index) => {
                      const tagObj =
                        typeof t === 'object' && t !== null && 'tag' in t
                          ? (t as { tag: { id?: number; name: string } }).tag
                          : t;
                      const tagName =
                        typeof tagObj === 'object' && tagObj !== null && 'name' in tagObj
                          ? tagObj.name
                          : String(tagObj);
                      const tagId =
                        typeof tagObj === 'object' && tagObj !== null && 'id' in tagObj
                          ? tagObj.id
                          : index;
                      const isBlue = tagName.toLowerCase() === 'reading';
                      return (
                        <span
                          key={tagId}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isBlue ? 'bg-data-blue text-white' : 'bg-caramel/30 text-cocoa'
                          }`}
                        >
                          {tagName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {entry.body ? (
                viewMode === 'read' ? (
                  <div className="text-sm text-cocoa prose prose-stone prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-xl border border-caramel/30 bg-canvas overflow-hidden shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-clay px-4 py-2.5 bg-cream/60 border-b border-caramel/20 flex items-center justify-between">
                      <span>Raw Markdown Source</span>
                      <Code2 className="h-3.5 w-3.5" />
                    </div>
                    <pre className="p-4 text-xs sm:text-sm font-mono text-cocoa whitespace-pre-wrap break-words bg-transparent overflow-x-auto select-text">
                      {entry.body}
                    </pre>
                  </div>
                )
              ) : contentRecord['Notes'] ? (
                <div className="text-sm text-cocoa whitespace-pre-wrap">
                  {String(contentRecord['Notes'])}
                </div>
              ) : (
                <p className="text-sm text-clay italic">No notes</p>
              )}

              <p className="pt-4 border-t border-caramel/15 text-xs text-clay">
                Logged {new Date(entry.createdAt).toLocaleString()}
              </p>
            </article>

            {/* Desktop Properties Sidebar */}
            <aside className="hidden lg:block w-80 shrink-0 space-y-6 text-xs border-l border-caramel/25 pl-8">
              <div className="flex items-center justify-between pb-2 border-b border-caramel/20">
                <h2 className="uppercase tracking-wider font-semibold text-clay">Properties</h2>
                <PanelRight className="h-4 w-4 text-clay" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-clay">
                    <span className="h-1.5 w-1.5 rounded-full bg-caramel" />
                    Project
                  </span>
                  <span className="font-semibold text-espresso text-right truncate max-w-[180px]">
                    {entry.project?.name ?? '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-clay">Date</span>
                  <span className="font-semibold text-espresso text-right">
                    {formattedDate || '—'}
                  </span>
                </div>

                {formattedDueDate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-clay">
                      <CalendarCheck className="h-3.5 w-3.5 text-clay" />
                      Due Date
                    </span>
                    <span className="font-semibold text-espresso text-right">
                      {formattedDueDate}
                    </span>
                  </div>
                )}
              </div>
              {contentEntries.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-caramel/20">
                  <h3 className="uppercase tracking-wider font-semibold text-clay mb-3">
                    Custom Fields
                  </h3>
                  <div className="space-y-3">
                    {contentEntries.map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <span className="text-clay truncate max-w-[140px]">{name}</span>
                        <span className="font-semibold text-espresso text-right truncate max-w-[180px]">
                          {typeof value === 'boolean'
                            ? value
                              ? 'Yes'
                              : 'No'
                            : value === null || value === undefined || value === ''
                              ? '—'
                              : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
      {isMobilePropertiesOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/40 backdrop-blur-sm">
          <div className="fixed inset-0" onClick={() => setIsMobilePropertiesOpen(false)} />
          <div className="relative bg-paper rounded-t-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto space-y-6 z-10 border-t border-caramel/30">
            <div className="flex items-center justify-between pb-3 border-b border-caramel/20">
              <h2 className="uppercase tracking-wider font-semibold text-xs text-clay">
                Properties
              </h2>
              <button
                type="button"
                onClick={() => setIsMobilePropertiesOpen(false)}
                className="p-1 text-clay hover:text-espresso"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-clay">Project</span>
                <span className="font-semibold text-espresso">{entry?.project?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-clay">Date</span>
                <span className="font-semibold text-espresso">{formattedDate || '—'}</span>
              </div>
              {formattedDueDate && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-clay">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Due Date
                  </span>
                  <span className="font-semibold text-espresso">{formattedDueDate}</span>
                </div>
              )}
            </div>
            {contentEntries.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-caramel/20 text-xs">
                <h3 className="uppercase tracking-wider font-semibold text-clay">Custom Fields</h3>
                <div className="space-y-3">
                  {contentEntries.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between gap-2">
                      <span className="text-clay">{name}</span>
                      <span className="font-semibold text-espresso">
                        {typeof value === 'boolean'
                          ? value
                            ? 'Yes'
                            : 'No'
                          : value === null || value === undefined || value === ''
                            ? '—'
                            : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-paper rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-caramel/30">
            <h3 className="text-lg font-bold text-espresso">Delete Entry</h3>
            <p className="text-sm text-cocoa">
              Are you sure you want to delete this entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteEntry.isPending}
                className="px-4 py-2 text-xs font-semibold text-cocoa hover:bg-caramel/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
                className="px-4 py-2 text-xs font-semibold text-white bg-danger hover:bg-danger-text rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteEntry.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
