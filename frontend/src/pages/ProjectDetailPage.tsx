import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import type { FieldDefinition, FieldType, Entry, Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowLeft } from 'lucide-react';

interface FieldRowProps {
  field: FieldDefinition;
  onRename: (newName: string) => void;
  onRetype: (newType: FieldType) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function FieldRow({ field, onRename, onRetype, onDelete, isDeleting }: FieldRowProps) {
  const fieldName = field.name ?? field.key ?? '';
  const fieldType = field.fieldType ?? field.type ?? 'text';

  const [name, setName] = useState(fieldName);

  const handleBlur = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== fieldName) {
      onRename(trimmed);
    } else {
      setName(fieldName);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#d4a373]/30 bg-white p-3 shadow-sm">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleBlur}
        aria-label="Field name"
        className="flex-1 rounded-md border border-[#d4a373]/60 px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
      />
      <select
        value={fieldType}
        onChange={(e) => onRetype(e.target.value as FieldType)}
        aria-label="Field type"
        className="rounded-md border border-[#d4a373]/60 bg-white px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
      >
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="date">Date</option>
        <option value="duration">Duration</option>
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onDelete}
        disabled={isDeleting}
        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete field</span>
      </Button>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const {
    data: project,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: !!projectId,
  });

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  const renameField = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.patch(`/api/fields/${input.id}`, { name: input.name }),
    onSuccess: invalidateProject,
  });

  const retypeField = useMutation({
    mutationFn: (input: { id: string; fieldType: FieldType }) =>
      api.patch(`/api/fields/${input.id}`, { fieldType: input.fieldType }),
    onSuccess: invalidateProject,
  });

  const deleteField = useMutation({
    mutationFn: (fieldId: string) => api.delete(`/api/fields/${fieldId}`),
    onSuccess: invalidateProject,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-[#d4a373]/20" />
        <div className="h-32 animate-pulse rounded-xl bg-[#d4a373]/20" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="m-6 rounded-xl border border-dashed border-[#d4a373]/50 bg-white/40 p-10 text-center">
        <p className="text-sm text-[#4a3525]">Project not found or accessible.</p>
        <Link
          to="/projects"
          className="mt-4 inline-block rounded-md bg-[#1c0d06] px-4 py-2 text-sm font-semibold text-[#f5ebe0]"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  const fields: FieldDefinition[] = project.fields ?? [];
  const entries: Entry[] = project.entries ?? [];

  return (
    <div className="flex flex-col gap-8 p-6 text-[#1c0d06]">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[#7a5230] hover:text-[#1c0d06]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-sm text-[#7a5230]">{project.description}</p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Field Definitions</h2>
        {fields.length === 0 ? (
          <p className="text-sm italic text-[#7a5230]/70">No fields defined for this project.</p>
        ) : (
          <div className="flex flex-col gap-3">
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
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Entries</h2>
        {entries.length === 0 ? (
          <p className="text-sm italic text-[#7a5230]/70">No entries recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-[#d4a373]/40 bg-white p-4 shadow-sm"
              >
                {entry.date && (
                  <p className="mb-2 text-xs font-semibold text-[#7a5230]">
                    {entry.date.slice(0, 10)}
                  </p>
                )}
                {entry.content &&
                typeof entry.content === 'object' &&
                !Array.isArray(entry.content) ? (
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(entry.content as Record<string, unknown>).map(([key, val]) => (
                      <div key={key} className="flex gap-2 text-sm">
                        <dt className="font-medium text-[#1c0d06]">{key}:</dt>
                        <dd className="text-[#4a3525]">{String(val)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-[#4a3525]">
                    {typeof entry.content === 'string'
                      ? entry.content
                      : 'No detailed content logged.'}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
