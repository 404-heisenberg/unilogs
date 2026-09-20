import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FieldInput } from '@/components/FieldInput';
import { api, ApiError } from '@/lib/api';
import { buildContent, defaultValueForType } from '@/lib/field-values';
import type { FieldValue } from '@/lib/field-values';
import type { Entry, FieldDefinition, Project } from '@/types';

const LAST_PROJECT_KEY = 'unilogs:last-project-id';

export default function EntryCreatePage() {
  const [projectId, setProjectId] = useState(() => localStorage.getItem(LAST_PROJECT_KEY) ?? '');
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
    onSuccess: (_, variables) => {
      localStorage.setItem(LAST_PROJECT_KEY, String(variables.projectId));
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

    // Client-side check so an incomplete entry never reaches the API. Every
    // field except boolean (where `false` is a valid answer) must be filled in.
    const nextFieldErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.fieldType === 'boolean') continue;
      const raw = values[field.name];
      if (raw === undefined || String(raw).trim() === '') {
        nextFieldErrors[field.name] = `${field.name} is required`;
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError(null);
      return;
    }

    const content = buildContent(fields, values);

    setFieldErrors({});
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
            className="min-h-11 border rounded px-3 py-2 w-full bg-white md:min-h-0"
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
            className="min-h-11 border rounded px-3 py-2 w-full md:min-h-0"
            required
          />
        </div>

        {projectId && fieldsQuery.isPending && (
          <p className="text-sm text-slate-500">Loading fields…</p>
        )}

        {projectId && !fieldsQuery.isPending && fields.length === 0 && (
          <p className="text-sm text-[#7a5230]">
            This project has no fields yet.{' '}
            <Link to={`/projects/${projectId}`} className="inline-block -my-3 py-3 underline">
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

        <Button
          type="submit"
          className="min-h-11 md:min-h-0"
          disabled={createEntry.isPending || !projectId || fields.length === 0}
        >
          {createEntry.isPending ? 'Saving…' : 'Save entry'}
        </Button>
      </form>
    </div>
  );
}
