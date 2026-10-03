import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, RotateCcw, History } from 'lucide-react';
import Skeleton from '@/components/Skeleton';
import { api } from '@/lib/api';
import { tagStyle } from '@/lib/colors';
import { entryDurationHours, formatDurationHours } from '@/lib/project-workspace';
import type { Entry, EntryVersion, FieldDefinition } from '@/types';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFieldValue(value: unknown, fieldType: string | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (fieldType === 'duration' && typeof value === 'number') return formatDurationHours(value);
  if (fieldType === 'date' && typeof value === 'string') return formatDate(value);
  return String(value);
}

function getVersionId(
  version: EntryVersion | Record<string, unknown>,
): number | string | undefined {
  const v = version as Record<string, unknown>;
  return (
    (v.id as number | string) ??
    (v.auditId as number | string) ??
    (v.versionId as number | string) ??
    (v.version_id as number | string)
  );
}

function getVersionTitle(
  version: EntryVersion | Record<string, unknown>,
  fallbackEntry: Entry | null,
): string {
  const v = version as Record<string, unknown>;
  const content = v.content as Record<string, unknown> | undefined;
  return (
    (v.title as string) ??
    (v.snapshot as Record<string, unknown>)?.title ??
    (v.data as Record<string, unknown>)?.title ??
    (typeof content === 'object' && content !== null && !Array.isArray(content)
      ? (content.title as string)
      : undefined) ??
    fallbackEntry?.title ??
    'Untitled entry'
  );
}

function getVersionBody(
  version: EntryVersion | Record<string, unknown>,
  fallbackEntry: Entry | null,
): string {
  const v = version as Record<string, unknown>;
  const content = v.content as Record<string, unknown> | undefined;
  return (
    (v.body as string) ??
    (v.snapshot as Record<string, unknown>)?.body ??
    (v.data as Record<string, unknown>)?.body ??
    (typeof content === 'object' && content !== null && !Array.isArray(content)
      ? (content.body as string)
      : undefined) ??
    fallbackEntry?.body ??
    ''
  );
}

function getVersionFields(
  version: EntryVersion | Record<string, unknown>,
  fallbackEntry: Entry | null,
): Record<string, unknown> {
  const v = version as Record<string, unknown>;
  const rawContent =
    v.content ??
    (v.snapshot as Record<string, unknown>)?.content ??
    (v.data as Record<string, unknown>)?.content ??
    fallbackEntry?.content ??
    {};

  if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
    const fields = { ...(rawContent as Record<string, unknown>) };
    delete fields.title;
    delete fields.body;
    return fields;
  }
  return {};
}

function getVersionTags(
  version: EntryVersion | Record<string, unknown>,
  fallbackEntry: Entry | null,
): Array<{ tag: { id: number; name: string; userId?: string } }> {
  const v = version as Record<string, unknown>;
  const snapshot = (v.snapshot ?? v.data ?? v) as Record<string, unknown>;
  const rawTags = v.tags ?? snapshot.tags;
  if (Array.isArray(rawTags)) {
    return rawTags.map((t: unknown) => {
      const item = t as Record<string, unknown>;
      if (item && typeof item === 'object') {
        if ('tag' in item && item.tag) {
          return item as { tag: { id: number; name: string; userId?: string } };
        }
        if ('id' in item && 'name' in item) {
          return { tag: item as unknown as { id: number; name: string; userId?: string } };
        }
      }
      return { tag: { id: 0, name: '' } };
    });
  }
  return fallbackEntry?.tags ?? [];
}

export default function EntryHistoryPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedVersionKey, setSelectedVersionKey] = useState<string | number | null>(null);

  const { data: entry } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => api.get<Entry>(`/api/entries/${entryId}`),
    enabled: !!entryId,
  });

  const projectId = entry ? String(entry.projectId) : undefined;
  const { data: fields = [] } = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const {
    data: rawVersions,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['entry-history', entryId],
    queryFn: () =>
      api.get<EntryVersion[] | { versions?: EntryVersion[]; data?: EntryVersion[] }>(
        `/api/entries/${entryId}/history`,
      ),
    enabled: !!entryId,
  });

  // Deduplicate history versions: process chronologically (oldest to newest) to preserve
  // the original edit milestone and filter out redundant duplicate logs generated by restores.
  const versions: EntryVersion[] = useMemo(() => {
    const raw = Array.isArray(rawVersions)
      ? rawVersions
      : Array.isArray((rawVersions as { versions?: EntryVersion[] })?.versions)
        ? (rawVersions as { versions: EntryVersion[] }).versions
        : Array.isArray((rawVersions as { data?: EntryVersion[] })?.data)
          ? (rawVersions as { data: EntryVersion[] }).data
          : [];

    const seenSignatures = new Set<string>();
    const uniqueOldestFirst: EntryVersion[] = [];
    const chronological = [...raw].reverse();

    for (const v of chronological) {
      const title = getVersionTitle(v, null);
      const body = getVersionBody(v, null);
      const fieldsObj = getVersionFields(v, null);
      const signature = JSON.stringify({ title, body, fields: fieldsObj });

      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        uniqueOldestFirst.push(v);
      }
    }

    return uniqueOldestFirst.reverse();
  }, [rawVersions]);

  // Derived active version key using useMemo to prevent state-in-effect cascading re-renders
  const activeVersionKey = useMemo(() => {
    if (
      selectedVersionKey !== null &&
      versions.some((v, idx) => (getVersionId(v) ?? v.createdAt ?? idx) === selectedVersionKey)
    ) {
      return selectedVersionKey;
    }
    return versions.length > 0 ? (getVersionId(versions[0]) ?? versions[0].createdAt ?? 0) : null;
  }, [versions, selectedVersionKey]);

  const selectedVersion =
    versions.find((v, idx) => {
      const vId = getVersionId(v) ?? v.createdAt ?? idx;
      return vId === activeVersionKey;
    }) ?? versions[0];

  const restoreMutation = useMutation({
    mutationFn: (versionId: number | string) =>
      api.post<Entry>(`/api/entries/${entryId}/history/${versionId}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entry-history', entryId] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      navigate(`/entries/${entryId}`);
    },
  });

  if (isPending) {
    return (
      <div className="p-6">
        <Skeleton rows={4} barClassName="h-14 rounded-xl" className="gap-3" />
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="rounded-xl border border-danger-soft bg-danger-soft p-6 text-sm text-error">
        Failed to load entry history.
      </div>
    );
  }

  const fieldTypes = new Map(fields.map((field) => [field.name, field.fieldType]));
  const contentRecord = getVersionFields(selectedVersion, entry);
  const contentEntries = Object.entries(contentRecord);
  const tags = getVersionTags(selectedVersion, entry);
  const projectName = entry.project?.name;
  const formattedDate = formatDate(selectedVersion?.createdAt ?? entry.date);
  const formattedTime = formatTime(selectedVersion?.createdAt ?? entry.createdAt);
  const hours =
    fields.length > 0 ? entryDurationHours({ ...entry, content: contentRecord }, fields) : null;

  const currentVersionTitle = getVersionTitle(selectedVersion, entry);
  const currentVersionBody = getVersionBody(selectedVersion, entry);

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row overflow-hidden bg-paper">
      {/* Left Sidebar: Version History */}
      <aside className="w-full lg:w-80 shrink-0 border-r border-cream bg-paper p-4 lg:p-6 overflow-y-auto flex flex-col gap-5 min-h-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              to={`/entries/${entryId}`}
              className="lg:hidden flex size-8 items-center justify-center rounded-md text-clay transition-colors hover:bg-cream hover:text-espresso"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </Link>
            <h2 className="text-[11px] font-bold text-clay tracking-wider uppercase">
              Version history
            </h2>
          </div>
          <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-cocoa">
            {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </span>
        </div>

        {versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper p-6 text-center text-xs text-clay italic">
            No previous versions yet
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((version, index) => {
              const vId = getVersionId(version);
              const vKey = vId ?? version.createdAt ?? index;
              const isSelected = vKey === activeVersionKey;
              const actionLabel =
                index === 0 && versions.length > 1
                  ? 'EDITED'
                  : index === versions.length - 1
                    ? 'CREATED'
                    : 'EDITED';
              const itemTitle = getVersionTitle(version, entry);

              return (
                <button
                  key={vKey}
                  type="button"
                  onClick={() => setSelectedVersionKey(vKey)}
                  className={`flex flex-col gap-1 rounded-lg p-3 text-left transition-colors border cursor-pointer ${
                    isSelected
                      ? 'bg-sand border-line shadow-xs'
                      : 'hover:bg-cream/60 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-clay tracking-wider">
                    <span>{actionLabel}</span>
                    <span>
                      {formatDate(version.createdAt)} {formatTime(version.createdAt)}
                    </span>
                  </div>
                  <span className="text-[13px] font-semibold text-espresso truncate">
                    {itemTitle}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Center: Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto z-10">
        {/* Top Header Bar */}
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-cream px-4 lg:px-8 py-3 bg-paper shrink-0">
          <nav
            aria-label="Breadcrumb"
            className="hidden lg:flex min-w-0 items-center gap-1.5 text-[13px]"
          >
            <Link
              to={`/projects/${entry.projectId}`}
              className="truncate font-medium text-gold hover:underline"
            >
              {projectName ?? 'Project'}
            </Link>
            <span className="text-clay">/</span>
            <Link
              to={`/entries/${entryId}`}
              className="truncate font-medium text-gold hover:underline"
            >
              {entry.title ?? 'Entry'}
            </Link>
            <span className="text-clay">/</span>
            <span className="truncate text-cocoa">History</span>
          </nav>

          <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
            <Link
              to={`/entries/${entryId}`}
              className="inline-flex min-h-8 items-center rounded-lg border border-line px-3 text-[13px] font-medium text-espresso transition-colors hover:bg-cream"
            >
              Back to current entry
            </Link>
            {activeVersionKey !== null && activeVersionKey !== undefined && (
              <button
                type="button"
                onClick={() => restoreMutation.mutate(activeVersionKey)}
                disabled={restoreMutation.isPending}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-gold px-3 text-[13px] font-semibold text-espresso transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw size={14} />
                {restoreMutation.isPending ? 'Restoring…' : 'Restore this version'}
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="max-w-3xl w-full mx-auto px-4 lg:px-8 py-8 flex flex-col gap-6">
          {selectedVersion && (
            <div className="rounded-lg bg-sand/70 border border-line px-4 py-2.5 text-xs text-cocoa flex items-center gap-2">
              <History size={14} className="text-gold shrink-0" />
              <span>
                Viewing version —{' '}
                <strong className="text-espresso">
                  {formattedDate} {formattedTime}
                </strong>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h1 className="text-[26px] font-bold text-espresso">{currentVersionTitle}</h1>
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

          <div className="flex flex-col gap-2 border-t border-cream pt-6">
            <h3 className="text-xs font-bold text-clay tracking-wider uppercase">
              Session Notes ({formattedDate} {formattedTime} Version)
            </h3>
          </div>

          {currentVersionBody ? (
            <div className="prose prose-sm max-w-none leading-relaxed text-espresso prose-headings:text-espresso prose-p:text-espresso prose-a:text-clay prose-strong:text-espresso">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentVersionBody}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-clay italic">No notes in this version</p>
          )}
        </div>
      </main>

      {/* Right Sidebar: Historical Fields & Project Origin */}
      <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-cream bg-paper p-4 lg:p-6 overflow-y-auto flex flex-col gap-6 min-h-0 z-10">
        <div className="flex flex-col gap-4">
          <h3 className="text-[11px] font-bold text-clay tracking-wider uppercase">
            Historical fields
          </h3>
          <div className="flex flex-col gap-3">
            {contentEntries.length === 0 ? (
              <span className="text-xs text-clay italic">No fields recorded</span>
            ) : (
              contentEntries.map(([name, value]) => (
                <div key={name} className="flex items-center justify-between text-[13px]">
                  <span className="text-clay truncate pr-2">{name}</span>
                  <span className="font-medium text-espresso text-right truncate">
                    {formatFieldValue(value, fieldTypes.get(name))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-cream pt-5">
          <h4 className="text-[11px] font-bold text-clay tracking-wider uppercase">
            Project origin
          </h4>
          <span className="text-xs text-espresso font-medium">
            {projectName ?? '—'}{' '}
            {entry.project &&
            typeof entry.project === 'object' &&
            'code' in entry.project &&
            entry.project.code
              ? `• ${String(entry.project.code)}`
              : ''}
          </span>
        </div>
      </aside>
    </div>
  );
}
