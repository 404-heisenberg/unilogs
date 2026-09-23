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
  Eye,
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
  const timeSpent = entry?.content?.['Time spent'];

  return (
    <div className="w-full p-6 lg:p-8 min-h-full flex flex-col relative">
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
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[#1c0d06] px-4 py-2 text-sm font-semibold text-[#f5ebe0] hover:opacity-90 transition-opacity"
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
        <div className="space-y-6 flex-1 flex flex-col">
          <header className="flex items-center justify-between pb-4 border-b border-[#d4a373]/20 shrink-0">
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Link
                to="/entries"
                className="text-[#b58352] hover:text-[#1c0d06] font-medium transition-colors"
              >
                {entry.project?.name ?? 'Timeline'}
              </Link>
              <span className="text-[#c2a68c]">/</span>
              <span className="text-[#1c0d06] font-medium truncate max-w-xs sm:max-w-md lg:max-w-xl">
                {entry.title ?? 'Entry'}
              </span>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3 relative">
              <Link
                to={`/entries/${entryId}/edit`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1c0d06] px-3.5 py-1.5 text-xs font-medium text-[#f5ebe0] hover:opacity-90 transition-opacity"
              >
                Edit
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="p-1.5 text-[#8a7a6e] hover:text-[#1c0d06] transition-colors rounded-md hover:bg-[#d4a373]/10"
                  aria-label="More options"
                >
                  <MoreHorizontal size={18} />
                </button>

                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 rounded-md bg-white shadow-lg border border-[#d4a373]/30 py-1 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
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
                className="p-1.5 text-[#8a7a6e] hover:text-[#1c0d06] transition-colors rounded-md hover:bg-[#d4a373]/10 lg:hidden"
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
                  <h1 className="text-3xl font-bold tracking-tight text-[#1c0d06]">
                    {entry.title ?? 'Entry'}
                  </h1>
                  <div className="inline-flex items-center rounded-lg border border-[#d4a373]/30 bg-white/60 p-1 shadow-sm shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('read')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        viewMode === 'read'
                          ? 'bg-[#1c0d06] text-[#f5ebe0] shadow-sm'
                          : 'text-[#8a7a6e] hover:text-[#1c0d06]'
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
                          ? 'bg-[#1c0d06] text-[#f5ebe0] shadow-sm'
                          : 'text-[#8a7a6e] hover:text-[#1c0d06]'
                      }`}
                    >
                      <Code2 size={14} />
                      Preview
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#8a7a6e]">
                  {entry.project?.name && (
                    <>
                      <span className="font-medium">{entry.project.name}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formattedDate}</span>
                  {timeSpent && (
                    <>
                      <span>•</span>
                      <span>{String(timeSpent)}</span>
                    </>
                  )}
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tags.map(({ tag }) => {
                      const isBlue = tag.name.toLowerCase() === 'reading';
                      return (
                        <span
                          key={tag.id}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isBlue ? 'bg-[#3b82f6] text-white' : 'bg-[#d4a373]/30 text-[#683f1d]'
                          }`}
                        >
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {entry.body ? (
                viewMode === 'read' ? (
                  <div className="text-sm text-[#4a3525] prose prose-stone prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.body}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#d4a373]/30 bg-[#f8f5f0] overflow-hidden shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#8a7a6e] px-4 py-2.5 bg-[#f3ecd8]/60 border-b border-[#d4a373]/20 flex items-center justify-between">
                      <span>Raw Markdown Source</span>
                      <Code2 className="h-3.5 w-3.5" />
                    </div>
                    <pre className="p-4 text-xs sm:text-sm font-mono text-[#4a3525] whitespace-pre-wrap break-words bg-transparent overflow-x-auto select-text">
                      {entry.body}
                    </pre>
                  </div>
                )
              ) : (
                <p className="text-sm text-[#7a5230] italic">No notes</p>
              )}

              <p className="pt-4 border-t border-[#d4a373]/15 text-xs text-[#8a7a6e]">
                Logged {new Date(entry.createdAt).toLocaleString()}
              </p>
            </article>

            {/* Desktop Properties Sidebar */}
            <aside className="hidden lg:block w-80 shrink-0 space-y-6 text-xs border-l border-[#d4a373]/25 pl-8">
              <div className="flex items-center justify-between pb-2 border-b border-[#d4a373]/20">
                <h2 className="uppercase tracking-wider font-semibold text-[#8a7a6e]">
                  Properties
                </h2>
                <PanelRight className="h-4 w-4 text-[#8a7a6e]" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#8a7a6e]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d4a373]" />
                    Project
                  </span>
                  <span className="font-semibold text-[#1c0d06] text-right truncate max-w-[180px]">
                    {entry.project?.name ?? '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#8a7a6e]">Date</span>
                  <span className="font-semibold text-[#1c0d06] text-right">
                    {formattedDate || '—'}
                  </span>
                </div>

                {formattedDueDate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[#8a7a6e]">
                      <CalendarCheck className="h-3.5 w-3.5 text-[#8a7a6e]" />
                      Due Date
                    </span>
                    <span className="font-semibold text-[#1c0d06] text-right">
                      {formattedDueDate}
                    </span>
                  </div>
                )}
              </div>
              {contentEntries.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-[#d4a373]/20">
                  <h3 className="uppercase tracking-wider font-semibold text-[#8a7a6e] mb-3">
                    Custom Fields
                  </h3>
                  <div className="space-y-3">
                    {contentEntries.map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <span className="text-[#8a7a6e] truncate max-w-[140px]">{name}</span>
                        <span className="font-semibold text-[#1c0d06] text-right truncate max-w-[180px]">
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
          <div className="relative bg-[#fefae0] rounded-t-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto space-y-6 z-10 border-t border-[#d4a373]/30">
            <div className="flex items-center justify-between pb-3 border-b border-[#d4a373]/20">
              <h2 className="uppercase tracking-wider font-semibold text-xs text-[#8a7a6e]">
                Properties
              </h2>
              <button
                type="button"
                onClick={() => setIsMobilePropertiesOpen(false)}
                className="p-1 text-[#8a7a6e] hover:text-[#1c0d06]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8a7a6e]">Project</span>
                <span className="font-semibold text-[#1c0d06]">{entry?.project?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8a7a6e]">Date</span>
                <span className="font-semibold text-[#1c0d06]">{formattedDate || '—'}</span>
              </div>
              {formattedDueDate && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#8a7a6e]">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Due Date
                  </span>
                  <span className="font-semibold text-[#1c0d06]">{formattedDueDate}</span>
                </div>
              )}
            </div>
            {contentEntries.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-[#d4a373]/20 text-xs">
                <h3 className="uppercase tracking-wider font-semibold text-[#8a7a6e]">
                  Custom Fields
                </h3>
                <div className="space-y-3">
                  {contentEntries.map(([name, value]) => (
                    <div key={name} className="flex items-center justify-between gap-2">
                      <span className="text-[#8a7a6e]">{name}</span>
                      <span className="font-semibold text-[#1c0d06]">
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
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#d4a373]/30">
            <h3 className="text-lg font-bold text-[#1c0d06]">Delete Entry</h3>
            <p className="text-sm text-[#4a3525]">
              Are you sure you want to delete this entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteEntry.isPending}
                className="px-4 py-2 text-xs font-semibold text-[#4a3525] hover:bg-[#d4a373]/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
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
