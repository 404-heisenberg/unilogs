import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  PanelRight,
  X,
  Plus,
  Trash2,
  CalendarCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FieldInput } from '@/components/FieldInput';
import { api, ApiError } from '@/lib/api';
import { buildContent, defaultValueForType } from '@/lib/field-values';
import type { FieldValue } from '@/lib/field-values';
import type { Entry, FieldDefinition, Project } from '@/types';

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
        className="w-full min-h-10 border border-stone-300 rounded bg-white p-1.5 flex flex-wrap gap-1.5 shadow-sm focus-within:border-stone-800 focus-within:ring-1 focus-within:ring-stone-800 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200"
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(tag.id);
              }}
              className="text-stone-400 hover:text-stone-600 focus:outline-none"
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
          placeholder={selectedIds.length === 0 ? 'Add tags...' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-stone-400"
        />
      </div>

      {isOpen && (inputValue.trim() || filteredTags.length > 0) && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-md shadow-lg max-h-48 overflow-y-auto overflow-x-hidden">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              onClick={() => handleSelect(tag.id)}
              className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              {tag.name}
            </div>
          ))}
          {inputValue.trim() && !exactMatch && (
            <div
              onClick={() => createTag.mutate(inputValue.trim())}
              className="px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 cursor-pointer flex items-center gap-2"
            >
              <Plus className="h-4 w-4 text-stone-400" />
              Create "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EntryEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const hasInitialized = useRef(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: entry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => api.get<Entry & { tags?: Tag[]; dueDate?: string }>(`/api/entries/${id}`),
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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (isEditing && entry && !hasInitialized.current) {
      setProjectId(String(entry.projectId));
      setDate(entry.date.slice(0, 10));
      setDueDate(entry.dueDate ? entry.dueDate.slice(0, 10) : '');
      setTitle(entry.title || '');
      setBody(entry.body || '');
      setTagIds(entry.tags?.map((t) => t.id) || []);
      setValues((entry.content as Record<string, FieldValue>) || {});
      hasInitialized.current = true;
    }
  }, [isEditing, entry]);

  useEffect(() => {
    if (fieldsQuery.data) {
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
  }, [fieldsQuery.data]);

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
      const { isKeyboardSave, ...payload } = input;
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

      if (variables.isKeyboardSave) {
        if (!isEditing && data?.id) {
          navigate(`/entries/${data.id}`, { replace: true });
        }
      } else {
        navigate('/entries');
      }
    },
    onError: (error) => {
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
      setFormError(general.length > 0 ? general.join(' ') : null);
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
      setFormError('Please select a project.');
      return;
    }

    if (!hasFields && !hasNarrative) {
      setFormError(
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
      setFormError(null);
      return;
    }

    const content = buildContent(fields, values);

    setFieldErrors({});
    setFormError(null);
    saveEntry.mutate({
      projectId: Number(projectId),
      date,
      dueDate: dueDate ? dueDate : undefined,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      content,
      isKeyboardSave,
    });
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

  useEffect(() => {
    if (!isEditing) {
      firstFieldRef.current?.focus();
    }
  }, [isEditing]);

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  // Navigation Guarding & Hotkey Handler
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
      <div className="flex h-[50vh] items-center justify-center text-stone-500">
        Loading entry...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-2">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Entry' : 'New Entry'}</h1>
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT COLUMN: Main Editor Area */}
        <div className="flex-1 w-full space-y-4 lg:pr-8 lg:border-r lg:border-stone-200">
          <div>
            <input
              id="entry-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Title (optional)"
              className="w-full border-b border-stone-200 bg-transparent px-0 pb-2 text-2xl font-bold tracking-tight text-stone-900 placeholder:text-stone-300 focus:border-stone-800 focus:outline-none"
            />
          </div>

          <div className="border rounded-md overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between border-b bg-stone-50 px-2 pt-2 gap-1 text-xs">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMode('write')}
                  className={`px-3 py-1.5 font-medium border-t border-x rounded-t ${
                    mode === 'write'
                      ? 'bg-white border-stone-300 border-b-white -mb-px text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setMode('preview')}
                  className={`px-3 py-1.5 font-medium border-t border-x rounded-t ${
                    mode === 'preview'
                      ? 'bg-white border-stone-300 border-b-white -mb-px text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {mode === 'write' && (
              <div className="flex items-center gap-0.5 border-b bg-stone-50/50 px-2 py-1 overflow-x-auto text-stone-600">
                <button
                  type="button"
                  onClick={() => applyFormatting('bold')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('italic')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Italics"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <div className="h-3.5 w-[1px] bg-stone-300 mx-1" />
                <button
                  type="button"
                  onClick={() => applyFormatting('heading')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Heading"
                >
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('list')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Bulleted List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('ordered-list')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Numbered List"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <div className="h-3.5 w-[1px] bg-stone-300 mx-1" />
                <button
                  type="button"
                  onClick={() => applyFormatting('code')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Code Block"
                >
                  <Code className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('quote')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Quote"
                >
                  <Quote className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting('link')}
                  className="p-1.5 rounded hover:bg-stone-200 hover:text-stone-900 transition-colors"
                  title="Link"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="p-3">
              {mode === 'write' ? (
                <textarea
                  ref={textareaRef}
                  id="entry-body"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="What did you work on? (GitHub-flavored Markdown supported)"
                  rows={14}
                  className="w-full font-mono text-sm resize-y focus:outline-none bg-transparent"
                />
              ) : (
                <div className="min-h-[296px] text-sm">
                  {body.trim() ? (
                    <div className="prose prose-stone prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-stone-400 italic">Nothing to preview</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {formError && <p className="text-sm text-red-700">{formError}</p>}

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              className="min-h-11 md:min-h-0 w-full md:w-auto"
              disabled={saveEntry.isPending || !projectId || (!hasFields && !hasNarrative)}
            >
              {saveEntry.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Save entry'}
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: Properties Sidebar Pane */}
        <div className="w-full lg:w-[320px] shrink-0 border border-stone-200 bg-stone-50/50 rounded-xl p-5 flex flex-col gap-6 lg:sticky lg:top-6 shadow-sm">
          <div className="flex items-center gap-2 text-stone-800 font-semibold border-b border-stone-200 pb-2">
            <PanelRight className="h-4 w-4" />
            <h2>Properties</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1.5 font-semibold text-stone-500">
                Project
              </label>
              <select
                ref={firstFieldRef}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full min-h-10 border border-stone-300 rounded bg-white px-3 py-1.5 text-sm shadow-sm focus:border-stone-800 focus:ring-1 focus:ring-stone-800 outline-none disabled:bg-stone-100 disabled:text-stone-500"
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
              <label className="block text-xs uppercase tracking-wider mb-1.5 font-semibold text-stone-500">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full min-h-10 border border-stone-300 rounded bg-white px-3 py-1.5 text-sm shadow-sm focus:border-stone-800 focus:ring-1 focus:ring-stone-800 outline-none"
                required
              />
            </div>

            {/* Conditional Due Date Picker with Clear Button */}
            {isTodoEnabled && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-stone-500 flex items-center gap-1.5">
                    <CalendarCheck className="h-3.5 w-3.5 text-stone-500" />
                    Due Date
                  </label>
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate('');
                        setIsDirty(true);
                      }}
                      className="text-xs text-stone-500 hover:text-stone-800 underline transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full min-h-10 border border-stone-300 rounded bg-white px-3 py-1.5 text-sm shadow-sm focus:border-stone-800 focus:ring-1 focus:ring-stone-800 outline-none"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-wider mb-1 font-semibold text-stone-500">
              Custom Schema Fields
            </label>

            {projectId && fieldsQuery.isPending && (
              <p className="text-sm text-stone-500 italic">Loading fields…</p>
            )}

            {projectId && !fieldsQuery.isPending && fields.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                No custom fields defined yet.{' '}
                <Link to={`/projects/${projectId}`} className="underline font-medium">
                  Add one
                </Link>
                .
              </p>
            )}

            {fields.map((field) => (
              <div
                key={field.id}
                className="bg-white p-3 rounded-md border border-stone-200 shadow-sm"
              >
                {field.fieldType === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.name] ?? false)}
                      onChange={(e) => {
                        setValues((prev) => ({ ...prev, [field.name]: e.target.checked }));
                        setIsDirty(true);
                      }}
                      className="h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-800"
                    />
                    <span className="text-sm font-medium text-stone-800">{field.name}</span>
                  </label>
                ) : (
                  <FieldInput
                    field={field}
                    value={values[field.name] ?? defaultValueForType(field.fieldType)}
                    error={fieldErrors[field.name]}
                    onChange={(value) => {
                      setValues((prev) => ({ ...prev, [field.name]: value }));
                      setIsDirty(true);
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2 font-semibold text-stone-500">
              Tags
            </label>
            <InlineTagInput selectedIds={tagIds} onChange={setTagIds} setIsDirty={setIsDirty} />
          </div>

          {/* Delete Action in Properties */}
          {isEditing && (
            <div className="pt-4 border-t border-stone-200 mt-auto">
              <label className="block text-xs uppercase tracking-wider mb-2 font-semibold text-red-600">
                Danger Zone
              </label>
              <Button
                type="button"
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 min-h-10"
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to delete this entry? This action cannot be undone.',
                    )
                  ) {
                    deleteEntry.mutate();
                  }
                }}
                disabled={deleteEntry.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteEntry.isPending ? 'Deleting...' : 'Delete entry'}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
