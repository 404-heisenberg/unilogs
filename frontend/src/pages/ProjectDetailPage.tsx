import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import type { FieldDefinition, Project } from '@/types';

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
    <li className="flex items-center gap-3 border rounded-lg p-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== field.name) onRename(trimmed);
          else setName(field.name);
        }}
        className="border rounded px-2 py-1 flex-1"
      />
      <select
        value={field.fieldType}
        onChange={(e) => onRetype(e.target.value as FieldType)}
        className="border rounded px-2 py-1 bg-white"
      >
        {FIELD_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <Button type="button" variant="destructive" onClick={onDelete} disabled={isDeleting}>
        {isDeleting ? 'Deleting…' : 'Delete'}
      </Button>
    </li>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });
  const project = projects?.find((p) => String(p.id) === projectId);

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', projectId],
    queryFn: () => api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${projectId}`),
    enabled: !!projectId,
  });

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
      <Link to="/projects" className="text-sm text-slate-500 hover:underline">
        &larr; Projects
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-4">{project?.name ?? 'Project'} fields</h1>

      {fieldsQuery.isPending && <p className="text-sm text-slate-500">Loading fields…</p>}
      {fieldsQuery.isError && <p className="text-sm text-red-700">Failed to load fields.</p>}
      {fieldsQuery.data?.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">
          No fields yet. Add your first field below to define what an entry for this project looks
          like.
        </p>
      )}

      <ul className="flex flex-col gap-2 mb-6">
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

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 max-w-lg">
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-sm mb-1">Field name</label>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="e.g. Time spent"
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Type</label>
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            className="border rounded px-3 py-2 bg-white"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={createField.isPending}>
          {createField.isPending ? 'Adding…' : 'Add field'}
        </Button>
      </form>
      {createField.isError && (
        <p className="text-sm text-red-700 mt-2">{createField.error.message}</p>
      )}
    </div>
  );
}
