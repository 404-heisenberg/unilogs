import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Code,
  Quote,
  Link as LinkIcon,
  X,
  Plus,
  Trash2,
  CalendarCheck,
  CloudOff,
} from 'lucide-react';

import { api, ApiError, type SyncQueuedEntry } from '@/lib/api';
import { buildContent, defaultValueForType } from '@/lib/field-values';
import type { FieldValue } from '@/lib/field-values';
import { enqueue, newClientId } from '@/lib/offline-queue';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { toast } from '@/lib/toast';
import type { Entry, FieldDefinition, Project } from '@/types';
import { tagStyle } from '@/lib/colors';
import PaneLayout, { PANE_LABEL } from '@/components/PaneLayout';
import Skeleton from '@/components/Skeleton';
import { Switch } from '@/components/ui/switch';

const LAST_PROJECT_KEY = 'unilogs:last-project-id';

type FormatOption =
  'bold' | 'italic' | 'heading' | 'list' | 'ordered-list' | 'code' | 'quote' | 'link';

type Tag = { id: number; name: string; color?: string };

function InlineTagInput({
  selectedIds,
  onChange,
  setIsDirty,
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  setIsDirty: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/api/tags').catch(() => []),
  });

  const createTag = useMutation({
    mutationFn: (name: string) => api.post<Tag>('/api/tags', { name }),
    onSuccess: (newTag) => {
      queryClient.setQueryData(['tags'], (old: Tag[] | undefined) => [...(old || []), newTag]);
      onChange([...selectedIds, newTag.id]);
      setIsDirty(true);
      setInputValue('');
    },
  });

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));
  const unselectedTags = tags.filter((t) => !selectedIds.includes(t.id));
  const filteredTags = unselectedTags.filter((t) =>
    t.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const exactMatch = tags.find((t) => t.name.toLowerCase() === inputValue.trim().toLowerCase());

  const handleSelect = (id: number) => {
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
      setIsDirty(true);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter((tId) => tId !== id));
    setIsDirty(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && inputValue === '' && selectedIds.length > 0) {
      handleRemove(selectedIds[selectedIds.length - 1]);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        if (exactMatch) {
          handleSelect(exactMatch.id);
        } else {
          createTag.mutate(inputValue.trim());
        }
      } else if (filteredTags.length > 0) {
        handleSelect(filteredTags[0].id);
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white p-1.5 focus-within:ring-2 focus-within:ring-espresso"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tagStyle(tag.name)}`}
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(tag.id);
              }}
              aria-label={`Remove ${tag.name}`}
              className="opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={selectedIds.length === 0 ? '+ Add tag' : '+'}
          aria-label="Add tag"
          className="min-w-[80px] flex-1 bg-transparent px-1 text-[13px] text-espresso outline-none placeholder:text-clay"
        />
      </div>

      {isOpen && (inputValue.trim() || filteredTags.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-x-hidden overflow-y-auto rounded-lg border border-line bg-paper shadow-lg">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              onClick={() => handleSelect(tag.id)}
              className="cursor-pointer px-3 py-2 text-[13px] text-espresso hover:bg-sand"
            >
              {tag.name}
            </div>
          ))}
          {inputValue.trim() && !exactMatch && (
            <div
              onClick={() => createTag.mutate(inputValue.trim())}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-espresso hover:bg-sand"
            >
              <Plus className="h-4 w-4 text-clay" />
              Create "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EntryCreatePage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const [searchParams] = useSearchParams();
  const prefill = isEditing ? null : searchParams;

  const [projectId, setProjectId] = useState(() => {
    return prefill?.get('projectId') || localStorage.getItem(LAST_PROJECT_KEY) || '';
  });
  const [date, setDate] = useState(() => {
    const requested = prefill?.get('date');
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : new Date().toISOString().slice(0, 10);
  });
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState(() => prefill?.get('title') ?? '');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isDirty, setIsDirty] = useState(false);
  const allowNavigationRef = useRef(false);
  const hasInitialized = useRef(false);
  const hasFieldDefaultsInitializedRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isOffline, queuedCount, refresh: refreshQueue } = useOfflineQueue();

  const { data: entry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.get<Entry>(`/api/entries/${id}`),
    enabled: isEditing,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });
  const fields = fieldsQuery.data ?? [];

  const selectedProject = (projects ?? []).find((p) => String(p.id) === projectId);
  const isTodoEnabled = selectedProject?.todoEnabled || fields.some((f) => f.todoEnabled);

  useEffect(() => {
    if (fieldsQuery.data && projectId && hasFieldDefaultsInitializedRef.current !== projectId) {
      hasFieldDefaultsInitializedRef.current = projectId;
      setValues((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const field of fieldsQuery.data) {
          if (next[field.name] === undefined) {
            next[field.name] =
              field.fieldType === 'boolean' ? false : defaultValueForType(field.fieldType);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [fieldsQuery.data, projectId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Block in-app navigation while there are unsaved changes. `allowNavigationRef`
  // is flipped around the post-save navigation so a just-saved entry can leave.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavigationRef.current && isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    if (isEditing && entry && !hasInitialized.current) {
      setProjectId(String(entry.projectId));
      setDate(entry.date.slice(0, 10));
      setDueDate(entry.dueDate ? entry.dueDate.slice(0, 10) : '');
      setTitle(entry.title || '');
      setBody(entry.body || '');

      const mappedTags =
        entry.tags
          ?.map((t: { id?: number; tag?: { id?: number } }) => t.tag?.id ?? t.id)
          .filter((tagId): tagId is number => typeof tagId === 'number') || [];
      setTagIds(mappedTags);

      setValues((entry.content as Record<string, FieldValue>) || {});
      hasInitialized.current = true;
    }
  }, [isEditing, entry]);

  /**
   * Puts a new entry on the offline queue instead of the network.
   *
   * The queue is create-only: `POST /api/entries/sync` upserts new rows and
   * never edits an existing one, so the callers guard this behind `!isEditing`.
   */
  const queueOffline = (entry: Omit<SyncQueuedEntry, 'clientId'>): boolean => {
    if (!enqueue({ ...entry, clientId: newClientId() })) {
      toast.error("Couldn't queue this entry offline.", {
        description: 'Device storage is full. Nothing was saved — reconnect and try again.',
        fallback: "Couldn't queue this entry offline.",
      });
      return false;
    }

    refreshQueue();
    toast.info('Saved offline — will sync later.');

    // Clear the editor rather than navigate. The entry is not in the timeline
    // yet, so landing there would look like the save was lost; staying put
    // keeps the queued-count badge on screen and leaves a clean form for the
    // next capture. Clearing also stops the same content being queued twice.
    setTitle('');
    setBody('');
    setValues({});
    setTagIds([]);
    setDueDate('');
    setIsDirty(false);
    return true;
  };

  const saveEntry = useMutation({
    mutationFn: (input: {
      projectId: number;
      date: string;
      dueDate?: string;
      title?: string;
      body?: string;
      tagIds?: number[];
      content: Record<string, unknown>;
      isKeyboardSave?: boolean;
    }) => {
      const { isKeyboardSave: keyboardSaveFlag, ...payload } = input;
      void keyboardSaveFlag;
      if (isEditing) {
        return api.put<Entry>(`/api/entries/${id}`, payload);
      }
      return api.post<Entry>('/api/entries', payload);
    },
    onSuccess: (data, variables) => {
      localStorage.setItem(LAST_PROJECT_KEY, String(variables.projectId));
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      if (isEditing) queryClient.invalidateQueries({ queryKey: ['entry', id] });

      setIsDirty(false);

      // Let the post-save navigation through the unsaved-changes blocker.
      allowNavigationRef.current = true;
      if (variables.isKeyboardSave) {
        if (!isEditing && data?.id) {
          navigate(`/entries/${data.id}`, { replace: true });
        }
      } else if (isEditing) {
        navigate(`/entries/${id}`, { replace: true });
      } else {
        navigate('/entries');
      }
      allowNavigationRef.current = false;
    },
    onError: (error, variables) => {
      // `navigator.onLine` only reports whether the machine has a network. A
      // request that never got an HTTP response rejects with something other
      // than ApiError, and that is a connectivity failure — the entry belongs
      // on the queue, not in an error toast.
      if (!(error instanceof ApiError) && !isEditing) {
        const { isKeyboardSave: keyboardSaveFlag, ...payload } = variables;
        void keyboardSaveFlag;
        queueOffline(payload);
        return;
      }

      const body = error instanceof ApiError ? (error.body as { errors?: string[] } | null) : null;
      const messages = Array.isArray(body?.errors) ? body.errors : [error.message];

      const nextFieldErrors: Record<string, string> = {};
      const general: string[] = [];
      for (const message of messages) {
        const match = message.match(/^Field '([^']+)'/);
        if (match) {
          nextFieldErrors[match[1]] = message;
        } else {
          general.push(message);
        }
      }
      setFieldErrors(nextFieldErrors);
      if (general.length > 0) toast.error(general.join(' '));
    },
  });

  const deleteEntry = useMutation({
    mutationFn: () => api.delete(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
    },
  });

  const hasFields = fields.length > 0;
  const hasNarrative = title.trim().length > 0 || body.trim().length > 0;

  const handleSubmit = (e?: React.FormEvent | KeyboardEvent, isKeyboardSave = false) => {
    if (e) e.preventDefault();

    if (!projectId) {
      toast.error('Please select a project.');
      return;
    }

    if (!hasFields && !hasNarrative) {
      toast.error(
        'Entries cannot be wholly empty. Please provide a title, notes, or fill in custom fields.',
      );
      return;
    }

    const nextFieldErrors: Record<string, string> = {};
    if (!hasNarrative) {
      for (const field of fields) {
        if (field.fieldType === 'boolean') continue;
        const raw = values[field.name];
        if (raw === undefined || String(raw).trim() === '') {
          nextFieldErrors[field.name] = `${field.name} is required`;
        }
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    const content = buildContent(fields, values);
    const payload = {
      projectId: Number(projectId),
      date,
      dueDate: dueDate ? dueDate : undefined,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      content,
    };

    setFieldErrors({});

    if (!navigator.onLine) {
      // The queue replays through the sync endpoint, which only ever creates
      // rows. Queueing an edit here would come back as a second entry with the
      // same content, so refuse it and leave the work on screen instead.
      if (isEditing) {
        toast.error("You're offline — an existing entry can't be edited yet.", {
          description: 'Your changes are still here. Reconnect, then save again.',
          fallback: "You're offline — edits can't be saved yet.",
        });
        return;
      }
      queueOffline(payload);
      return;
    }

    saveEntry.mutate({ ...payload, isKeyboardSave });
  };

  const applyFormatting = (type: FormatOption) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.slice(start, end);

    let prefix = '';
    let suffix = '';
    let replacement = selectedText;

    switch (type) {
      case 'bold':
        prefix = '**';
        suffix = '**';
        replacement = selectedText || 'bold text';
        break;
      case 'italic':
        prefix = '*';
        suffix = '*';
        replacement = selectedText || 'italic text';
        break;
      case 'heading':
        prefix = '## ';
        replacement = selectedText || 'Heading';
        break;
      case 'list':
        prefix = '- ';
        replacement = selectedText || 'List item';
        break;
      case 'ordered-list':
        prefix = '1. ';
        replacement = selectedText || 'List item';
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          prefix = '```\n';
          suffix = '\n```';
          replacement = selectedText || 'code block';
        } else {
          prefix = '`';
          suffix = '`';
          replacement = selectedText || 'code';
        }
        break;
      case 'quote':
        prefix = '> ';
        replacement = selectedText || 'Blockquote';
        break;
      case 'link':
        prefix = '[';
        suffix = '](https://example.com)';
        replacement = selectedText || 'link text';
        break;
    }

    const newText = body.slice(0, start) + prefix + replacement + suffix + body.slice(end);
    setBody(newText);
    setIsDirty(true);

    setTimeout(() => {
      textarea.focus();
      const selectionStart = start + prefix.length;
      const selectionEnd = selectionStart + replacement.length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  // When Enter is pressed inside a bullet or ordered list item, carry the
  // marker onto the next line; an empty item drops the marker to end the list.
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) return;

    const before = body.slice(0, start);
    const after = body.slice(end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineText = before.slice(lineStart);

    const bullet = lineText.match(/^\s*([-*+])\s+/);
    const ordered = lineText.match(/^\s*(\d+)[.)]\s+/);
    if (!bullet && !ordered) return;

    const markerLength = (bullet ?? ordered)![0].length;

    // Empty item: end the list by removing the bare marker.
    if (lineText.slice(markerLength).trim() === '') {
      e.preventDefault();
      setBody(body.slice(0, lineStart) + after);
      setIsDirty(true);
      setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
      return;
    }

    // Non-empty item: continue the list with the next marker.
    e.preventDefault();
    const marker = bullet ? `${bullet[1]} ` : `${parseInt(ordered![1], 10) + 1}. `;
    setBody(`${before}\n${marker}${after}`);
    setIsDirty(true);
    const caret = start + 1 + marker.length;
    setTimeout(() => textarea.setSelectionRange(caret, caret), 0);
  };

  useEffect(() => {
    if (!isEditing) {
      firstFieldRef.current?.focus();
    }
  }, [isEditing]);

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty) {
          if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
            navigate('/entries');
          }
        } else {
          navigate('/entries');
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmitRef.current(e, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, isDirty]);

  if (isEditing && isLoadingEntry) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Skeleton rows={1} barClassName="h-8 w-64" />
        <Skeleton rows={1} barClassName="h-4 w-40" className="mt-3" />
        <Skeleton rows={6} className="mt-8" />
      </div>
    );
  }

  const projectName = (projects ?? []).find((p) => String(p.id) === projectId)?.name;
  const toolbarButton =
    'rounded p-1.5 text-cocoa transition-colors hover:bg-cream hover:text-espresso';
  const paneInput =
    'w-full min-h-11 rounded-lg border border-line bg-white px-3 text-[13px] text-espresso outline-none focus:ring-2 focus:ring-espresso disabled:bg-cream disabled:text-clay md:min-h-9';
  const paneFieldLabel = 'mb-1.5 block text-xs text-clay';

  const properties = (
    <div className="flex flex-col gap-5">
      <h2 className={PANE_LABEL}>Properties</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="entry-project" className={paneFieldLabel}>
            Project
          </label>
          <select
            ref={firstFieldRef}
            id="entry-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setIsDirty(true);
            }}
            className={paneInput}
            required
            disabled={isEditing}
          >
            <option value="">Select a project…</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="entry-date" className={paneFieldLabel}>
            Date
          </label>
          <input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setIsDirty(true);
            }}
            className={paneInput}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-cream pt-5">
        <span className={PANE_LABEL}>Custom fields</span>

        {projectId && fieldsQuery.isPending && (
          <p className="text-[13px] text-clay italic">Loading fields…</p>
        )}

        {projectId && !fieldsQuery.isPending && fields.length === 0 && (
          <p className="rounded-lg border border-line bg-cream p-3 text-[13px] text-cocoa">
            No custom fields defined yet.{' '}
            <Link to={`/projects/${projectId}`} className="font-semibold underline">
              Add one
            </Link>
            .
          </p>
        )}

        {fields.map((field) => {
          const fieldId = `field-${field.id}`;
          const value = values[field.name] ?? defaultValueForType(field.fieldType);
          const error = fieldErrors[field.name];
          const inputClassName = `${paneInput} ${error ? 'border-error' : ''}`;

          return (
            <div key={field.id}>
              {field.fieldType === 'boolean' ? (
                <>
                  <span className={paneFieldLabel}>{field.name}</span>
                  <label
                    htmlFor={fieldId}
                    className={`flex min-h-11 cursor-pointer items-center justify-between rounded-lg border bg-white px-3 md:min-h-9 ${
                      error ? 'border-error' : 'border-line'
                    }`}
                  >
                    <span className="text-[13px] text-espresso">{value ? 'Yes' : 'No'}</span>
                    <Switch
                      id={fieldId}
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => {
                        setValues((prev) => ({ ...prev, [field.name]: checked }));
                        setIsDirty(true);
                      }}
                      aria-label={field.name}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label htmlFor={fieldId} className={paneFieldLabel}>
                    {field.name}
                  </label>
                  {field.fieldType === 'number' || field.fieldType === 'duration' ? (
                    <input
                      id={fieldId}
                      type="number"
                      step="any"
                      // Durations are stored in hours (the backend sums them as hours).
                      placeholder={field.fieldType === 'duration' ? 'Hours, e.g. 1.5' : undefined}
                      value={
                        typeof value === 'boolean'
                          ? ''
                          : value === 0 && values[field.name] === undefined
                            ? ''
                            : value
                      }
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setValues((prev) => ({ ...prev, [field.name]: val }));
                        setIsDirty(true);
                      }}
                      className={inputClassName}
                    />
                  ) : field.fieldType === 'date' ? (
                    <input
                      id={fieldId}
                      type="date"
                      value={String(value)}
                      onChange={(e) => {
                        setValues((prev) => ({ ...prev, [field.name]: e.target.value }));
                        setIsDirty(true);
                      }}
                      className={inputClassName}
                    />
                  ) : (
                    <input
                      id={fieldId}
                      type="text"
                      value={String(value)}
                      onChange={(e) => {
                        setValues((prev) => ({ ...prev, [field.name]: e.target.value }));
                        setIsDirty(true);
                      }}
                      className={inputClassName}
                    />
                  )}
                </>
              )}
              {error && <p className="mt-1 text-xs text-error">{error}</p>}
            </div>
          );
        })}

        {isTodoEnabled && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="entry-due-date"
                className="flex items-center gap-1.5 text-xs text-clay"
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Due date
              </label>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDueDate('');
                    setIsDirty(true);
                  }}
                  className="text-xs text-clay underline transition-colors hover:text-espresso"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              id="entry-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setIsDirty(true);
              }}
              className={paneInput}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-cream pt-5">
        <span className={PANE_LABEL}>Tags</span>
        <InlineTagInput selectedIds={tagIds} onChange={setTagIds} setIsDirty={setIsDirty} />
      </div>

      {isEditing && (
        <div className="border-t border-cream pt-5">
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-danger-soft text-[13px] font-medium text-danger-text transition-opacity hover:opacity-90 disabled:opacity-60 md:min-h-9"
            onClick={() => {
              if (
                window.confirm(
                  'Delete this entry? It will move to Recently deleted, where you can restore it from the project workspace.',
                )
              ) {
                deleteEntry.mutate();
              }
            }}
            disabled={deleteEntry.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {deleteEntry.isPending ? 'Deleting…' : 'Delete entry'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="contents">
      <PaneLayout pane={properties} paneLabel="Entry properties">
        <h1 className="sr-only">{isEditing ? 'Edit entry' : 'New entry'}</h1>

        {/* Figma's thin top bar: breadcrumb, unsaved-changes hint, save. */}
        <div className="-mx-4 -mt-4 mb-6 flex min-h-12 items-center justify-between gap-3 border-b border-cream px-4 md:-mx-12 md:-mt-12 md:mb-10 md:px-12">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {projectId && projectName ? (
              <Link
                to={`/projects/${projectId}`}
                className="truncate font-medium text-gold hover:underline"
              >
                {projectName}
              </Link>
            ) : (
              <Link to="/entries" className="font-medium text-gold hover:underline">
                Entries
              </Link>
            )}
            <span className="text-clay">/</span>
            <span className="truncate text-cocoa">
              {title.trim() || (isEditing ? 'Untitled entry' : 'New entry')}
            </span>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {isDirty && (
              <span className="hidden items-center gap-1.5 text-xs text-clay sm:inline-flex">
                <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                Unsaved changes
                <kbd className="ml-1 font-sans text-[11px] text-taupe">Ctrl+S</kbd>
              </span>
            )}
            {(!isEditing || isDirty || saveEntry.isPending) && (
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg bg-espresso px-4 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50 md:min-h-8"
                disabled={saveEntry.isPending || !projectId || (!hasFields && !hasNarrative)}
              >
                {saveEntry.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Save entry'}
              </button>
            )}
          </div>
        </div>

        {/* Figma prompt 8. Both halves are independent: the banner explains what
            will happen, the badge counts what is actually waiting. The badge
            survives a reconnect while the flush is still in flight. */}
        {(isOffline || queuedCount > 0) && (
          <div
            role="status"
            className="-mx-4 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-cream bg-clay/10 px-4 py-3 text-sm text-espresso md:-mx-12 md:px-12"
          >
            {isOffline && (
              <span className="flex items-center gap-2">
                <CloudOff className="size-4 shrink-0 text-clay" aria-hidden />
                You&apos;re offline — entries will sync when you reconnect.
              </span>
            )}
            {queuedCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-clay/15 px-2.5 py-0.5 text-xs font-semibold text-clay">
                {queuedCount} {queuedCount === 1 ? 'entry' : 'entries'} queued
              </span>
            )}
          </div>
        )}

        <label htmlFor="entry-title" className="sr-only">
          Title
        </label>
        <input
          id="entry-title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Untitled entry"
          className="w-full bg-transparent text-[26px] font-bold text-espresso outline-none placeholder:text-taupe"
        />

        <div className="mt-5 flex items-center justify-between gap-3 border-b border-cream pb-3">
          <div
            className={`flex items-center gap-0.5 overflow-x-auto ${mode === 'write' ? '' : 'invisible'}`}
          >
            <button
              type="button"
              onClick={() => applyFormatting('bold')}
              className={toolbarButton}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('italic')}
              className={toolbarButton}
              title="Italics"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('heading')}
              className={toolbarButton}
              title="Heading"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-3.5 w-px bg-line" />
            <button
              type="button"
              onClick={() => applyFormatting('list')}
              className={toolbarButton}
              title="Bulleted List"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('ordered-list')}
              className={toolbarButton}
              title="Numbered List"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('code')}
              className={toolbarButton}
              title="Code Block"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('quote')}
              className={toolbarButton}
              title="Quote"
            >
              <Quote className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('link')}
              className={toolbarButton}
              title="Link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex shrink-0 rounded-lg bg-cream p-0.5 text-xs font-medium">
            {(['write', 'preview'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={`rounded-md px-3 py-1 capitalize ${
                  mode === option
                    ? 'bg-white text-espresso shadow-sm'
                    : 'text-clay hover:text-espresso'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4">
          {mode === 'write' ? (
            <>
              <label htmlFor="entry-body" className="sr-only">
                Body notes
              </label>
              <textarea
                ref={textareaRef}
                id="entry-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setIsDirty(true);
                }}
                onKeyDown={handleBodyKeyDown}
                placeholder="What did you work on? (GitHub-flavored Markdown supported)"
                rows={16}
                className="w-full resize-y bg-transparent font-mono text-[13px] leading-relaxed text-espresso outline-none placeholder:text-taupe"
              />
            </>
          ) : (
            <div className="min-h-[296px] text-sm">
              {body.trim() ? (
                <div className="prose prose-sm max-w-none prose-headings:text-espresso prose-p:text-espresso prose-a:text-clay">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-taupe italic">Nothing to preview</p>
              )}
            </div>
          )}
        </div>
      </PaneLayout>
    </form>
  );
}
