import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import type { Entry, FieldDefinition, Project } from '@/types';

const isTextAreaType = (type: string) => {
  const normalized = String(type).toLowerCase().replace(/[-_]/g, '');
  return normalized === 'textarea' || normalized === 'multiline' || normalized === 'longtext';
};

export function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
}) {
  if (isTextAreaType(field.fieldType)) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${field.name.toLowerCase()}...`}
        rows={4}
        className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none transition focus:ring-2 focus:ring-[#1c0d06]"
      />
    );
  }

  return (
    <input
      type={field.fieldType === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        field.fieldType === 'duration' ? 'e.g. 1h 30m' : `Enter ${field.name.toLowerCase()}...`
      }
      className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none transition focus:ring-2 focus:ring-[#1c0d06]"
    />
  );
}

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
  const [prevFieldName, setPrevFieldName] = useState(field.name);

  // Render-phase state synchronization replacing the useEffect hook
  if (field.name !== prevFieldName) {
    setPrevFieldName(field.name);
    setName(field.name);
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md[cite: 2]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== field.name) onRename(trimmed);
          else setName(field.name);
        }}
        className="min-w-[8rem] flex-1 rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
      />
      <select
        value={field.fieldType}
        onChange={(e) => onRetype(e.target.value as FieldType)}
        className="rounded-md border border-[#d4a373]/60 bg-white px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
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
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting…' : 'Delete'}
      </Button>
    </li>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FIELD_TYPES[0]);

  const [showLogForm, setShowLogForm] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryContent, setEntryContent] = useState<Record<string, string>>({});

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
    queryKey: ['entries'],
    queryFn: () => api.get<Entry[]>('/api/entries'),
  });

  const projectEntries = (entriesQuery.data ?? []).filter(
    (entry) => entry.projectId === Number(projectId),
  );

  const invalidateFields = () => {
    queryClient.invalidateQueries({ queryKey: ['field-definitions', projectId] });
    queryClient.invalidateQueries({ queryKey: ['field-definitions'] });
  };

  const createField = useMutation({
    mutationFn: (input: { name: string; fieldType: FieldType }) =>
      api.post<FieldDefinition>('/api/field-definitions', {
        projectId: Number(projectId),
        ...input,
      }),
    onSuccess: () => {
      invalidateFields();
      setNewFieldName('');
      setNewFieldType(FIELD_TYPES[0]);
    },
  });

  const renameField = useMutation({
    mutationFn: (input: { id: number; name: string }) =>
      api.put<FieldDefinition>(`/api/field-definitions/${input.id}`, { name: input.name }),
    onSuccess: invalidateFields,
  });

  const retypeField = useMutation({
    mutationFn: (input: { id: number; fieldType: FieldType }) =>
      api.put<FieldDefinition>(`/api/field-definitions/${input.id}`, {
        fieldType: input.fieldType,
      }),
    onSuccess: invalidateFields,
  });

  const deleteField = useMutation({
    mutationFn: (id: number) => api.delete(`/api/field-definitions/${id}`),
    onSuccess: invalidateFields,
  });

  const createEntryMutation = useMutation({
    mutationFn: (newEntry: { projectId: number; date: string; content: Record<string, string> }) =>
      api.post('/api/entries', newEntry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      setEntryContent({});
      setShowLogForm(false);
    },
  });

  const syncFieldsFromEntries = useMutation({
    mutationFn: async () => {
      if (!projectEntries.length || !projectId) return;

      const builtInKeys = new Set(['date', 'id', 'projectid', 'createdat', 'updatedat']);
      const existingFieldNames = new Set(
        (fieldsQuery.data ?? []).map((f) => f.name.trim().toLowerCase()),
      );

      const uniqueFieldsToCreate = new Map<string, { name: string; fieldType: FieldType }>();

      projectEntries.forEach((entry) => {
        Object.entries(entry.content || {}).forEach(([rawKey, val]) => {
          const key = rawKey.trim();
          const normalizedKey = key.toLowerCase();

          if (
            !key ||
            builtInKeys.has(normalizedKey) ||
            existingFieldNames.has(normalizedKey) ||
            uniqueFieldsToCreate.has(normalizedKey)
          ) {
            return;
          }

          let inferredType: FieldType = 'text';
          if (typeof val === 'string' && (val.includes('\n') || val.length > 40)) {
            inferredType = 'textarea';
          } else if (typeof val === 'string' && /\d+h|\d+m/.test(val)) {
            inferredType = 'duration';
          } else if (val !== null && val !== '' && !isNaN(Number(val))) {
            inferredType = 'number';
          }

          uniqueFieldsToCreate.set(normalizedKey, { name: key, fieldType: inferredType });
        });
      });

      if (uniqueFieldsToCreate.size === 0) return;

      for (const { name, fieldType } of uniqueFieldsToCreate.values()) {
        try {
          await api.post<FieldDefinition>('/api/field-definitions', {
            projectId: Number(projectId),
            name,
            fieldType,
          });
        } catch {
          // Ignore if already created
        }
      }
    },
    onSuccess: invalidateFields,
  });

  // Render-phase check for syncing fields from entries without using setState in useEffect
  const [prevEntriesLength, setPrevEntriesLength] = useState(projectEntries.length);
  const [hasSynced, setHasSynced] = useState(false);

  if (
    fieldsQuery.isSuccess &&
    entriesQuery.isSuccess &&
    projectEntries.length > 0 &&
    !syncFieldsFromEntries.isPending &&
    (!hasSynced || projectEntries.length !== prevEntriesLength)
  ) {
    setPrevEntriesLength(projectEntries.length);
    setHasSynced(true);

    const existingNames = new Set((fieldsQuery.data ?? []).map((f) => f.name.trim().toLowerCase()));
    const builtInKeys = new Set(['date', 'id', 'projectid', 'createdat', 'updatedat']);

    const hasUnregisteredKeys = projectEntries.some((entry) =>
      Object.keys(entry.content || {}).some((k) => {
        const norm = k.trim().toLowerCase();
        return norm && !builtInKeys.has(norm) && !existingNames.has(norm);
      }),
    );

    if (hasUnregisteredKeys) {
      syncFieldsFromEntries.mutate();
    }
  }

  const handleCreateField = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    createField.mutate({ name: trimmed, fieldType: newFieldType });
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    createEntryMutation.mutate({
      projectId: Number(projectId),
      date: entryDate,
      content: entryContent,
    });
  };

  const fields = fieldsQuery.data ?? [];

  return (
    <div>
      <Link to="/projects" className="text-sm text-[#7a5230] hover:text-[#1c0d06][cite: 2]">
        &larr; Projects
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
          {projectQuery.data?.name ?? 'Project'}
        </h1>
        {projectQuery.data?.description && (
          <p className="mt-1 text-sm whitespace-pre-wrap text-[#7a5230]">
            {projectQuery.data.description}
          </p>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-[#1c0d06]">Fields</h2>

      {(fieldsQuery.isPending || syncFieldsFromEntries.isPending) && (
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

      {!syncFieldsFromEntries.isPending && fieldsQuery.data?.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">
            No fields defined yet. Add your first field below to structure future log entries.
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
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-sm text-[#4a3525]">Field name</label>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="e.g. Exercises"
            className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[#4a3525]">Type</label>
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            className="rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
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
          className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
          disabled={createField.isPending}
        >
          {createField.isPending ? 'Adding…' : 'Add field'}
        </Button>
      </form>
      {createField.isError && (
        <p className="mt-2 text-sm text-red-700">{createField.error.message}</p>
      )}

      <div className="mt-10 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1c0d06]">Entries</h2>
        <Button
          type="button"
          onClick={() => setShowLogForm((prev) => !prev)}
          className="bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
        >
          {showLogForm ? 'Cancel' : '+ Quick Log Entry'}
        </Button>
      </div>

      {showLogForm && (
        <form
          onSubmit={handleCreateEntry}
          className="mb-6 flex flex-col gap-4 rounded-xl border border-[#d4a373]/60 bg-white p-6 shadow-sm"
        >
          <h3 className="font-semibold text-[#1c0d06]">New Log Entry</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a3525]">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-md border border-[#d4a373]/60 bg-white px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
              required
            />
          </div>

          {fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-[#4a3525]">
                {field.name}{' '}
                <span className="text-xs font-normal text-[#7a5230]/80">({field.fieldType})</span>
              </label>
              <DynamicFieldInput
                field={field}
                value={entryContent[field.name] ?? ''}
                onChange={(val) => setEntryContent((prev) => ({ ...prev, [field.name]: val }))}
              />
            </div>
          ))}

          <Button
            type="submit"
            disabled={createEntryMutation.isPending}
            className="mt-2 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
          >
            {createEntryMutation.isPending ? 'Saving…' : 'Save Entry'}
          </Button>
        </form>
      )}

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

      {entriesQuery.isSuccess && projectEntries.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
          <p className="text-sm text-[#4a3525]">No entries logged for this project yet.</p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {projectEntries.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              className="block rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-semibold text-[#7a5230]">{entry.date.slice(0, 10)}</p>
              <dl className="mt-2 flex flex-col gap-3">
                {Object.entries(entry.content).map(([name, value]) => {
                  const strVal = String(value ?? '');
                  const fieldDef = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
                  const isTextArea = fieldDef
                    ? isTextAreaType(fieldDef.fieldType)
                    : strVal.includes('\n');

                  return (
                    <div
                      key={name}
                      className={
                        isTextArea
                          ? 'flex flex-col gap-1 text-sm'
                          : 'flex items-baseline gap-2 text-sm'
                      }
                    >
                      <dt className="font-medium text-[#1c0d06]">{name}:</dt>
                      <dd className="whitespace-pre-wrap text-[#4a3525]">{strVal}</dd>
                    </div>
                  );
                })}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
