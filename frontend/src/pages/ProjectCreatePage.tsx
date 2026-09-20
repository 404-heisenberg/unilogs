import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import { api } from '@/lib/api';
import type { Project } from '@/types';

type Step = 'details' | 'fields' | 'save';
const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'fields', label: 'Fields' },
  { key: 'save', label: 'Save' },
];

type DraftField = { name: string; fieldType: FieldType };

const TEMPLATES: { name: string; description: string; fields: DraftField[] }[] = [
  {
    name: 'Study log',
    description: 'Time spent — duration, Pages read — number, Mood — text',
    fields: [
      { name: 'Time spent', fieldType: 'duration' },
      { name: 'Pages read', fieldType: 'number' },
      { name: 'Mood', fieldType: 'text' },
    ],
  },
  {
    name: 'Workout',
    description: 'Duration — duration, Sets — number, Feel — text',
    fields: [
      { name: 'Duration', fieldType: 'duration' },
      { name: 'Sets', fieldType: 'number' },
      { name: 'Feel', fieldType: 'text' },
    ],
  },
  {
    name: 'Blank',
    description: 'No fields — add your own',
    fields: [],
  },
];

export default function ProjectCreatePage() {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FIELD_TYPES[0]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: async (input: { name: string; description?: string; fields: DraftField[] }) => {
      const project = await api.post<Project>('/api/projects', {
        name: input.name,
        description: input.description,
      });
      await Promise.all(
        input.fields.map((field) =>
          api.post('/api/field-definitions', {
            projectId: project.id,
            name: field.name,
            fieldType: field.fieldType,
          }),
        ),
      );
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${project.id}`);
    },
  });

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTemplate(t.name);
    setFields(t.fields);
  };

  const addField = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    setFields((f) => [...f, { name: trimmed, fieldType: newFieldType }]);
    setNewFieldName('');
    setNewFieldType(FIELD_TYPES[0]);
    setTemplate(null);
  };

  const removeField = (index: number) => {
    setFields((f) => f.filter((_, i) => i !== index));
    setTemplate(null);
  };

  const handleCreate = () => {
    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      fields,
    });
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={`text-sm font-medium ${
                s.key === step ? 'text-[#1c0d06]' : 'text-[#a68c73]'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-[#d4a373]/40" />}
          </div>
        ))}
      </div>

      {step === 'details' && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">New Project</h1>
          <div>
            <label className="block text-sm mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gym"
              className="min-h-11 border rounded px-3 py-2 w-full md:min-h-0"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project for?"
              className="min-h-11 border rounded px-3 py-2 w-full md:min-h-0"
            />
          </div>
          <Button
            type="button"
            className="min-h-11 md:min-h-0"
            disabled={!name.trim()}
            onClick={() => setStep('fields')}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 'fields' && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Fields</h1>
          <p className="text-sm text-[#7a5230]">
            Start from a template, or build your own field set below.
          </p>

          <div className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`rounded-xl border p-3 text-left ${
                  template === t.name
                    ? 'border-[#d4a843] bg-[#d4a843]/10'
                    : 'border-[#d4a373]/40 bg-white'
                }`}
              >
                <p className="font-semibold text-[#1c0d06]">{t.name}</p>
                <p className="mt-0.5 text-xs text-[#7a5230]">{t.description}</p>
              </button>
            ))}
          </div>

          {fields.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[#4a3525]">Custom fields</p>
              {fields.map((field, i) => (
                <div
                  key={`${field.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-[#d4a373]/40 bg-white px-3 py-2"
                >
                  <span className="text-sm text-[#1c0d06]">
                    {field.name} — {field.fieldType}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    aria-label={`Remove ${field.name}`}
                    className="flex size-11 shrink-0 items-center justify-center text-[#8c2121]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addField} className="flex flex-wrap items-end gap-2">
            <input
              type="text"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              placeholder="Field name"
              aria-label="Field name"
              className="min-h-11 min-w-0 flex-1 rounded border px-3 py-2 md:min-h-0"
            />
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as FieldType)}
              aria-label="Field type"
              className="min-h-11 rounded border bg-white px-2 py-2 md:min-h-0"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" className="min-h-11 md:min-h-0">
              Add field
            </Button>
          </form>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 md:min-h-0"
              onClick={() => setStep('details')}
            >
              Back
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1 md:min-h-0"
              onClick={() => setStep('save')}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'save' && (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Review</h1>
          <div className="rounded-xl border border-[#d4a373]/40 bg-white p-4">
            <p className="font-semibold text-[#1c0d06]">{name}</p>
            {description && <p className="mt-1 text-sm text-[#7a5230]">{description}</p>}
            <p className="mt-3 text-xs font-medium tracking-wide text-[#7a5230] uppercase">
              Fields
            </p>
            {fields.length === 0 ? (
              <p className="mt-1 text-sm text-[#4a3525]">
                No fields — you can add some later from the project page.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1">
                {fields.map((field, i) => (
                  <li key={`${field.name}-${i}`} className="text-sm text-[#4a3525]">
                    {field.name} — {field.fieldType}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {createProject.isError && (
            <p className="text-sm text-red-700">{createProject.error.message}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1 md:min-h-0"
              onClick={() => setStep('fields')}
              disabled={createProject.isPending}
            >
              Back
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1 md:min-h-0"
              onClick={handleCreate}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
