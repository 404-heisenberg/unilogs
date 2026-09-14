import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import type { Entry, FieldDefinition, Project } from '@/types';

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

  // The entries endpoint returns every entry the user owns; narrow to this
  // project client-side (see issue #85 for the Basic-tier scaling note).
  const projectEntries = (entriesQuery.data ?? []).filter(
    (entry) => entry.projectId === Number(projectId),
  );

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FIELD_TYPES[0]);

  const invalidateFields = () =>
    queryClient.invalidateQueries({ queryKey: ['field-definitions', projectId] });

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    createField.mutate({ name: trimmed, fieldType: newFieldType });
  };

  return (
    <div>
      <Link to="/projects" className="text-sm text-[#7a5230] hover:text-[#1c0d06]">
        &larr; Projects
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">
          {projectQuery.data?.name ?? 'Project'}
        </h1>
        {projectQuery.data?.description && (
          <p className="mt-1 text-sm text-[#7a5230]">{projectQuery.data.description}</p>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-[#1c0d06]">Fields</h2>

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
            No fields yet. Add your first field below to define what an entry for this project looks
            like.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {(fieldsQuery.data ?? []).map((field) => (
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
        onSubmit={handleCreate}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-4"
      >
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-sm text-[#4a3525]">Field name</label>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="e.g. Time spent"
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

      <h2 className="mt-10 mb-3 text-lg font-semibold text-[#1c0d06]">Entries</h2>

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
          <Link to="/entries/new">
            <Button className="mt-4 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90">
              Log an entry
            </Button>
          </Link>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {projectEntries.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              className="block rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-sm text-[#7a5230]">{entry.date.slice(0, 10)}</p>
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
  );
}
