import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { Download, EllipsisVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import { formatRelativeTime } from '@/lib/time';
import { downloadTextFile, entriesToCSV, entriesToMarkdown } from '@/lib/exportEntries';
import type { Entry, FieldDefinition, PagedEntries, Project } from '@/types';
import { toast } from '@/lib/toast';

const LAST_PROJECT_KEY = 'unilogs:last-project-id';

function FieldRow({
  field,
  onRename,
  onRetype,
  onDelete,
  isDeleting,
}: {
  field: FieldDefinition;
  onRename: (name: string) => void;
  onRetype: (fieldType: FieldType) => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [name, setName] = useState(field.name);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== field.name) onRename(trimmed);
          else setName(field.name);
        }}
        className="min-h-11 min-w-32 flex-1 rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
      />
      <select
        value={field.fieldType}
        onChange={(e) => onRetype(e.target.value as FieldType)}
        className="min-h-11 rounded-md border border-[#d4a373]/60 bg-white px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
      >
        {FIELD_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="min-h-11 md:min-h-0"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : 'Delete'}
      </Button>
    </li>
  );
}

// Last 8 ISO (Monday-start) weeks' entry counts, for the Overview activity chart.
function weeklyCounts(entries: Entry[]): { week: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - i * 7 + 1);
    weekStart.setHours(0, 0, 0, 0);
    buckets.set(weekStart.toISOString().slice(0, 10), 0);
  }
  const keys = Array.from(buckets.keys());
  for (const entry of entries) {
    const entryDate = new Date(entry.date);
    for (let i = keys.length - 1; i >= 0; i--) {
      if (entryDate >= new Date(keys[i])) {
        buckets.set(keys[i], (buckets.get(keys[i]) ?? 0) + 1);
        break;
      }
    }
  }
  return keys.map((week) => ({ week, count: buckets.get(week) ?? 0 }));
}

type Tab = 'overview' | 'entries' | 'fields';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'entries', label: 'Entries' },
  { key: 'fields', label: 'Fields' },
];

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameDescription, setRenameDescription] = useState('');

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const entriesQuery = useQuery({
    queryKey: ['entries', { projectId }],
    queryFn: () => api.get<PagedEntries>(`/api/entries?projectId=${projectId}&limit=100`),
    enabled: !!projectId,
  });

  const fields = fieldsQuery.data ?? [];
  const entries = entriesQuery.data?.entries ?? [];
  const totalEntries = entriesQuery.data?.total ?? entries.length;

  const durationFieldNames = fields.filter((f) => f.fieldType === 'duration').map((f) => f.name);
  const trackedMinutes = entries.reduce((sum, entry) => {
    let total = 0;
    for (const name of durationFieldNames) {
      const value = entry.content[name];
      if (typeof value === 'number') total += value;
    }
    return sum + total;
  }, 0);
  const trackedHours = Math.floor(trackedMinutes / 60);
  const trackedRemainderMinutes = Math.round(trackedMinutes % 60);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekCount = entries.filter((entry) => new Date(entry.date) >= weekAgo).length;

  const lastLogged = entries[0];
  const activity = weeklyCounts(entries);
  const maxWeek = Math.max(1, ...activity.map((w) => w.count));

  const invalidateFields = () =>
    queryClient.invalidateQueries({ queryKey: ['field-definitions', projectId] });

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const updateProject = useMutation({
    mutationFn: (input: { name: string; description: string | null }) =>
      api.patch<Project>(`/api/projects/${projectId}`, input),
    onSuccess: () => {
      invalidateProject();
      setRenaming(false);
    },
    onError: (error) => toast.error(error),
  });

  const archiveToggle = useMutation({
    mutationFn: () =>
      api.post<Project>(
        `/api/projects/${projectId}/${projectQuery.data?.archived ? 'unarchive' : 'archive'}`,
      ),
    onSuccess: invalidateProject,
    onError: (error) => toast.error(error),
  });

  const startRenaming = () => {
    setRenameName(projectQuery.data?.name ?? '');
    setRenameDescription(projectQuery.data?.description ?? '');
    setRenaming(true);
    setMenuOpen(false);
  };

  const createField = useMutation({
    mutationFn: (input: { name: string; fieldType: FieldType }) =>
      api.post<FieldDefinition>('/api/field-definitions', {
        projectId: Number(projectId),
        ...input,
      }),
    onSuccess: invalidateFields,
    onError: (error) => toast.error(error),
  });

  const renameField = useMutation({
    mutationFn: (input: { id: number; name: string }) =>
      api.put<FieldDefinition>(`/api/field-definitions/${input.id}`, { name: input.name }),
    onSuccess: invalidateFields,
    onError: (error) => toast.error(error),
  });

  const retypeField = useMutation({
    mutationFn: (input: { id: number; fieldType: FieldType }) =>
      api.put<FieldDefinition>(`/api/field-definitions/${input.id}`, {
        fieldType: input.fieldType,
      }),
    onSuccess: invalidateFields,
    onError: (error) => toast.error(error),
  });

  const deleteField = useMutation({
    mutationFn: (id: number) => api.delete(`/api/field-definitions/${id}`),
    onSuccess: invalidateFields,
    onError: (error) => toast.error(error),
  });

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FIELD_TYPES[0]);
  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    createField.mutate(
      { name: trimmed, fieldType: newFieldType },
      { onSuccess: () => setNewFieldName('') },
    );
  };

  const handleLogEntry = () => {
    if (projectId) localStorage.setItem(LAST_PROJECT_KEY, projectId);
  };

  const exportName = projectQuery.data?.name ?? 'project';
  const handleExportCSV = () =>
    downloadTextFile(`${exportName}.csv`, entriesToCSV(entries, fields), 'text/csv');
  const handleExportMarkdown = () =>
    downloadTextFile(
      `${exportName}.md`,
      entriesToMarkdown(entries, fields, exportName),
      'text/markdown',
    );

  return (
    <div>
      <Link
        to="/projects"
        className="inline-block -my-3 py-3 text-sm text-[#7a5230] hover:text-[#1c0d06]"
      >
        &larr; Projects
      </Link>

      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProject.mutate({
              name: renameName.trim(),
              description: renameDescription.trim() || null,
            });
          }}
          className="mt-2 mb-4 flex flex-col gap-2 rounded-xl border border-[#d4a373]/40 bg-white p-4"
        >
          <input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            aria-label="Project name"
            className="min-h-11 rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
            required
          />
          <input
            value={renameDescription}
            onChange={(e) => setRenameDescription(e.target.value)}
            placeholder="Description"
            aria-label="Project description"
            className="min-h-11 rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="min-h-11 md:min-h-0"
              disabled={updateProject.isPending || !renameName.trim()}
            >
              {updateProject.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 md:min-h-0"
              onClick={() => setRenaming(false)}
              disabled={updateProject.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2 mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
                {projectQuery.data?.name ?? 'Project'}
              </h1>
              {projectQuery.data?.archived && (
                <span className="rounded-full bg-[#f5ebe0] px-2 py-0.5 text-xs font-medium text-[#7a5230]">
                  Archived
                </span>
              )}
            </div>
            {projectQuery.data?.description && (
              <p className="mt-1 text-sm text-[#7a5230]">{projectQuery.data.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={entries.length === 0}
              className="flex min-h-11 items-center gap-1.5 rounded-md border border-[#d4a373]/50 px-3 text-sm font-medium text-[#1c0d06] hover:bg-[#f5ebe0] disabled:opacity-50"
            >
              <Download size={14} strokeWidth={1.75} />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={entries.length === 0}
              className="flex min-h-11 items-center gap-1.5 rounded-md border border-[#d4a373]/50 px-3 text-sm font-medium text-[#1c0d06] hover:bg-[#f5ebe0] disabled:opacity-50"
            >
              <Download size={14} strokeWidth={1.75} />
              Markdown
            </button>
            <Link to="/entries/new" onClick={handleLogEntry}>
              <Button className="min-h-11 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90 md:min-h-0">
                Log
              </Button>
            </Link>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Project actions"
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-[#7a5230] hover:bg-[#f5ebe0] md:size-9"
                >
                  <EllipsisVertical size={18} strokeWidth={1.75} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={4}
                className="w-44 rounded-xl border border-[#d4c4b0] bg-[#fffcf7] p-1 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)]"
              >
                <button
                  type="button"
                  onClick={startRenaming}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-[#1c0d06] hover:bg-[#f5ebe0]"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    archiveToggle.mutate();
                    setMenuOpen(false);
                  }}
                  disabled={archiveToggle.isPending}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-[#1c0d06] hover:bg-[#f5ebe0] disabled:opacity-50"
                >
                  {projectQuery.data?.archived ? 'Unarchive' : 'Archive'}
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-1 border-b border-[#d4a373]/30">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${
              tab === t.key
                ? 'border-[#d4a843] text-[#1c0d06]'
                : 'border-transparent text-[#a68c73]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
              <p className="text-xs text-[#7a5230]">Entries</p>
              <p className="mt-1 text-2xl font-bold text-[#1c0d06]">{totalEntries}</p>
            </div>
            <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
              <p className="text-xs text-[#7a5230]">Tracked</p>
              <p className="mt-1 text-2xl font-bold text-[#1c0d06]">
                {trackedHours}h {trackedRemainderMinutes}m
              </p>
            </div>
            <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
              <p className="text-xs text-[#7a5230]">Last logged</p>
              <p className="mt-1 text-lg font-bold text-[#1c0d06]">
                {lastLogged ? formatRelativeTime(lastLogged.date) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
              <p className="text-xs text-[#7a5230]">This week</p>
              <p className="mt-1 text-2xl font-bold text-[#1c0d06]">{thisWeekCount}</p>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
              <p className="mb-3 text-xs font-bold tracking-wide text-[#7a5230] uppercase">
                Activity — last 8 weeks
              </p>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={activity}>
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {activity.map((week, i) => (
                      <Cell
                        key={i}
                        fill={week.count === 0 ? '#e8ddd0' : '#d4a843'}
                        opacity={week.count === 0 ? 1 : 0.4 + 0.6 * (week.count / maxWeek)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {entries.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-[#1c0d06]">Recent entries</p>
              <ul className="flex flex-col gap-2">
                {entries.slice(0, 5).map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={`/entries/${entry.id}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[#d4a373]/40 bg-white px-3 hover:shadow-sm"
                    >
                      <span className="truncate text-sm font-medium text-[#1c0d06]">
                        {entry.title ?? entry.date.slice(0, 10)}
                      </span>
                      <span className="shrink-0 text-xs text-[#7a5230]">
                        {formatRelativeTime(entry.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entries.length === 0 && !entriesQuery.isPending && (
            <p className="text-sm text-[#7a5230]">
              No entries yet — log your first one to see stats here.
            </p>
          )}
        </div>
      )}

      {tab === 'entries' && (
        <div>
          {entriesQuery.isPending && (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-[#d4a373]/20" />
              ))}
            </div>
          )}

          {entriesQuery.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load entries. Try refreshing the page.
            </div>
          )}

          {entriesQuery.isSuccess && entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
              <p className="text-sm text-[#4a3525]">No entries logged for this project yet.</p>
              <Link to="/entries/new" onClick={handleLogEntry}>
                <Button className="mt-4 min-h-11 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90 md:min-h-0">
                  Log an entry
                </Button>
              </Link>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={`/entries/${entry.id}`}
                  className="block rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="text-sm text-[#7a5230]">{entry.date.slice(0, 10)}</p>
                  {entry.title && (
                    <p className="mt-0.5 font-semibold text-[#1c0d06]">{entry.title}</p>
                  )}
                  <dl className="mt-1 flex flex-col gap-0.5">
                    {Object.entries(entry.content).map(([name, value]) => (
                      <div key={name} className="flex gap-2 text-sm">
                        <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                        <dd className="text-[#4a3525]">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'fields' && (
        <div>
          {fieldsQuery.isPending && (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-[#d4a373]/20" />
              ))}
            </div>
          )}

          {fieldsQuery.isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load fields. Try refreshing the page.
            </div>
          )}

          {fieldsQuery.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
              <p className="text-sm text-[#4a3525]">
                No fields yet. Add your first field below to define what an entry for this project
                looks like.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onRename={(name) => renameField.mutate({ id: field.id, name })}
                onRetype={(fieldType) => retypeField.mutate({ id: field.id, fieldType })}
                onDelete={() => deleteField.mutate(field.id)}
                isDeleting={deleteField.isPending && deleteField.variables === field.id}
              />
            ))}
          </ul>

          <form
            onSubmit={handleCreateField}
            className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-4"
          >
            <div className="min-w-40 flex-1">
              <label className="mb-1 block text-sm text-[#4a3525]">Field name</label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g. Time spent"
                className="min-h-11 w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#4a3525]">Type</label>
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                className="min-h-11 rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              className="min-h-11 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90 md:min-h-0"
              disabled={createField.isPending}
            >
              {createField.isPending ? 'Adding…' : 'Add field'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
