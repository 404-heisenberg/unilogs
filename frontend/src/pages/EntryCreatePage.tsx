import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import type { Entry, FieldDefinition, Project } from '@/types';

type FieldValue = string | number | boolean;

function defaultValueForType(fieldType: string): FieldValue {
  return fieldType === 'boolean' ? false : '';
}

function toContentValue(fieldType: string, raw: FieldValue): unknown {
  if (fieldType === 'number' || fieldType === 'duration') {
    if (raw === '') return raw;
    const num = Number(raw);
    return Number.isNaN(num) ? raw : num;
  }
  if (fieldType === 'boolean') return Boolean(raw);
  return raw;
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDefinition;
  value: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
}) {
  const inputClassName = `w-full rounded-md border px-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 ${
    error ? 'border-red-500 focus:ring-red-500' : 'border-[#d4a373]/60 focus:ring-[#1c0d06]'
  }`;

  return (
    <div>
      <label className="mb-1 block text-sm text-[#4a3525]">{field.name}</label>
      {field.fieldType === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm text-[#1c0d06]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-[#d4a373] accent-[#1c0d06]"
          />
          Yes
        </label>
      ) : field.fieldType === 'date' ? (
        <input
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      ) : field.fieldType === 'number' || field.fieldType === 'duration' ? (
        <input
          type="number"
          value={value as string | number}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.fieldType === 'duration' ? 'minutes' : undefined}
          className={inputClassName}
        />
      ) : (
        <input
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export default function EntryCreatePage() {
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const firstFieldRef = useRef<HTMLSelectElement>(null);

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

  // Reset the entered values whenever the selected project's field set
  // changes, so stale values from a previous project's fields never leak
  // into a new submission. Adjusting state during render (React's documented
  // pattern for this) instead of in an effect, since resetting derived state
  // in an effect causes an extra render pass.
  const [loadedFields, setLoadedFields] = useState(fieldsQuery.data);
  if (fieldsQuery.data !== loadedFields) {
    setLoadedFields(fieldsQuery.data);
    const initial: Record<string, FieldValue> = {};
    for (const field of fieldsQuery.data ?? []) {
      initial[field.name] = defaultValueForType(field.fieldType);
    }
    setValues(initial);
    setFieldErrors({});
    setFormError(null);
  }

  const createEntry = useMutation({
    mutationFn: (input: { projectId: number; date: string; content: Record<string, unknown> }) =>
      api.post<Entry>('/api/entries', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/entries');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || fields.length === 0) return;

    const content: Record<string, unknown> = {};
    for (const field of fields) {
      content[field.name] = toContentValue(field.fieldType, values[field.name] ?? '');
    }

    createEntry.mutate({ projectId: Number(projectId), date, content });
  };

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/entries');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New Entry</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm mb-1">Project</label>
          <select
            ref={firstFieldRef}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded px-3 py-2 w-full bg-white"
            required
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
          <label className="block text-sm mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>

        {projectId && fieldsQuery.isPending && (
          <p className="text-sm text-slate-500">Loading fields…</p>
        )}

        {projectId && !fieldsQuery.isPending && fields.length === 0 && (
          <p className="text-sm text-[#7a5230]">
            This project has no fields yet.{' '}
            <Link to={`/projects/${projectId}`} className="underline">
              Add some
            </Link>{' '}
            before logging an entry.
          </p>
        )}

        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.name] ?? defaultValueForType(field.fieldType)}
            error={fieldErrors[field.name]}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
          />
        ))}

        {formError && <p className="text-sm text-red-700">{formError}</p>}

        <Button type="submit" disabled={createEntry.isPending || !projectId || fields.length === 0}>
          {createEntry.isPending ? 'Saving…' : 'Save entry'}
        </Button>
      </form>
    </div>
  );
}
