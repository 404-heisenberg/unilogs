import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD_TYPES, type FieldType } from '@/lib/field-types';
import { api } from '@/lib/api';
import type { Project } from '@/types';
import ProjectsPage from './ProjectsPage';

export const LAST_PROJECT_KEY = 'last_selected_project_id';

type Step = 'details' | 'fields' | 'save';

const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'fields', label: 'Fields' },
  { key: 'save', label: 'Save' },
];

const COLOR_OPTIONS = [
  { label: 'Amber', hex: '#d4a268' },
  { label: 'Gold', hex: '#cbbb40' },
  { label: 'Olive Green', hex: '#3e6b48' },
  { label: 'Purple', hex: '#7b5e7b' },
  { label: 'Slate Blue', hex: '#527a9c' },
];

type DraftField = { name: string; fieldType: FieldType };

type TemplateOption = {
  name: string;
  description?: string;
  fields: DraftField[];
};

const DEFAULT_TEMPLATES: TemplateOption[] = [
  {
    name: 'Study log',
    fields: [
      { name: 'Time spent', fieldType: 'duration' },
      { name: 'Pages read', fieldType: 'number' },
      { name: 'Mood', fieldType: 'text' },
    ],
  },
  {
    name: 'Workout',
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
  const [color, setColor] = useState(COLOR_OPTIONS[2].hex);
  const [template, setTemplate] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FIELD_TYPES[0]);
  const [isAddingField, setIsAddingField] = useState(false);
  const [reminder, setReminder] = useState<'off' | 'daily' | 'weekly'>('weekly');

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Determine if the user has any progress made
  const hasUnsavedChanges =
    name.trim() !== '' || description.trim() !== '' || fields.length > 0 || step !== 'details';

  // Warn user on browser refresh/unload if they have unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser requirement to show generic warning modal
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Fetch up to 5 user project templates
  const { data: userProjectTemplates = [] } = useQuery({
    queryKey: ['user-projects-templates'],
    queryFn: async () => {
      const projects = await api.get<Project[]>('/api/projects');
      const recentProjects = projects.slice(0, 5);

      const templatesWithFields = await Promise.all(
        recentProjects.map(async (proj) => {
          try {
            const projectFields = await api.get<DraftField[]>(
              `/api/field-definitions?projectId=${proj.id}`,
            );
            return {
              name: proj.name,
              description: proj.description ?? undefined,
              fields: projectFields.map((f) => ({ name: f.name, fieldType: f.fieldType })),
            };
          } catch {
            return {
              name: proj.name,
              description: proj.description ?? undefined,
              fields: [],
            };
          }
        }),
      );

      return templatesWithFields;
    },
  });

  // Display at most 5 user project templates + "Blank" option (or default templates)
  const displayedTemplates: TemplateOption[] =
    userProjectTemplates.length > 0
      ? [
          ...userProjectTemplates.slice(0, 5),
          { name: 'Blank', description: 'No fields — add your own', fields: [] },
        ]
      : DEFAULT_TEMPLATES;

  const createProject = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      color: string;
      reminder: 'off' | 'daily' | 'weekly';
      fields: DraftField[];
    }) => {
      const project = await api.post<Project>('/api/projects', {
        name: input.name,
        description: input.description,
        color: input.color,
        reminder: input.reminder,
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
  });

  const handleCancel = () => {
    navigate('/projects');
  };

  const handleTopBack = () => {
    if (step === 'save') setStep('fields');
    else if (step === 'fields') setStep('details');
    else handleCancel();
  };

  // Copies template field definitions without overriding the user's project name
  const applyTemplate = (t: TemplateOption) => {
    setTemplate(t.name);
    setFields([...t.fields]);
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFieldName.trim();
    if (!trimmed) return;
    setFields((f) => [...f, { name: trimmed, fieldType: newFieldType }]);
    setNewFieldName('');
    setNewFieldType(FIELD_TYPES[0]);
    setIsAddingField(false);
    setTemplate(null);
  };

  const removeField = (index: number) => {
    setFields((f) => f.filter((_, i) => i !== index));
    setTemplate(null);
  };

  const retypeField = (index: number, fieldType: FieldType) => {
    setFields((f) => f.map((field, i) => (i === index ? { ...field, fieldType } : field)));
  };

  const handleSave = (shouldLogFirstEntry: boolean) => {
    createProject.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        reminder,
        fields,
      },
      {
        onSuccess: (project) => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          if (shouldLogFirstEntry) {
            const projectIdStr = String(project.id);
            localStorage.setItem(LAST_PROJECT_KEY, projectIdStr);
            navigate(`/entries/new?projectId=${projectIdStr}`, {
              state: { projectId: project.id },
            });
          } else {
            navigate(`/projects/${project.id}`);
          }
        },
      },
    );
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="relative min-h-screen bg-[#fffcf8]">
      {/* Background Projects page (Blurred on desktop modal view) */}
      <div
        className="pointer-events-none select-none opacity-40 filter blur-[1px] hidden sm:block"
        aria-hidden="true"
      >
        <ProjectsPage />
      </div>

      {/* Responsive Dialog Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fffcf8] sm:bg-black/40 sm:p-6 backdrop-blur-[2px]">
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[716px] sm:rounded-2xl bg-[#fffcf8] sm:shadow-2xl sm:border sm:border-[#e6ded5] flex flex-col justify-between overflow-hidden">
          {/* Header & Stepper Progress */}
          <div className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-[#f0e6da]/60 bg-[#fffcf8]">
            {/* Mobile Header Navigation */}
            <div className="flex items-center justify-between mb-4 sm:hidden">
              <button
                type="button"
                onClick={handleTopBack}
                className="p-1 -ml-1 text-[#4a3d31]"
                aria-label="Back"
              >
                <ChevronLeft size={22} />
              </button>
              <h2 className="text-base font-bold text-[#1c0d06] text-center flex-1">
                Create project
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm font-medium text-[#c05621]"
              >
                Cancel
              </button>
            </div>

            {/* Desktop Header Title */}
            <h2 className="hidden sm:block text-lg font-bold text-[#1c0d06] mb-4">
              Create project
            </h2>

            {/* Step Indicators */}
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1 flex-1 rounded-full ${
                      i <= stepIndex ? 'bg-[#d9a74a]' : 'bg-[#ebdccb]'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`flex-1 text-center text-[11px] ${
                      i === stepIndex ? 'font-bold text-[#4a3d31]' : 'font-normal text-[#8c7a6b]'
                    }`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* STEP 1: DETAILS */}
            {step === 'details' && (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[#4a3d31] mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Data Structures Revision"
                    className="w-full rounded-xl border border-[#e0d6cc] bg-white px-3.5 py-3 text-sm text-[#1c0d06] outline-none focus:border-[#d9a74a]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4a3d31] mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Weekly problem sets and past-paper drills"
                    className="w-full rounded-xl border border-[#e0d6cc] bg-white px-3.5 py-3 text-sm text-[#1c0d06] outline-none focus:border-[#d9a74a] resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4a3d31] mb-2">Colour</label>
                  <div className="flex items-center gap-3">
                    {COLOR_OPTIONS.map((c) => {
                      const isSelected = color === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setColor(c.hex)}
                          style={{ backgroundColor: c.hex }}
                          className={`relative size-8 rounded-full transition-transform ${
                            isSelected ? 'ring-2 ring-[#1c0d06] ring-offset-2 scale-105' : ''
                          }`}
                          aria-label={`Select ${c.label}`}
                        >
                          {isSelected && (
                            <Check size={14} className="text-white mx-auto" strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: FIELDS */}
            {step === 'fields' && (
              <div className="flex flex-col gap-6">
                {/* Template Section Header & Cards */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-[#1c0d06]">Start from a template</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {displayedTemplates.map((t) => {
                      const selected = template === t.name;
                      return (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className={`relative w-full rounded-2xl p-4 text-left transition-all ${
                            selected
                              ? 'border-2 border-[#d9a74a] bg-white shadow-xs'
                              : 'border border-[#e0d6cc] bg-white hover:border-[#b8a48e]'
                          }`}
                        >
                          <p className="font-bold text-sm text-[#1c0d06]">{t.name}</p>
                          {t.fields.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {t.fields.map((field) => (
                                <p key={field.name} className="text-xs text-[#7a6e65]">
                                  {field.name} —{' '}
                                  <span className="text-[#8c7a6b]">{field.fieldType}</span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-[#8c7a6b]">
                              {t.description || 'No fields — add your own'}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Fields Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#1c0d06]">Custom fields</p>
                    {!isAddingField && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingField(true)}
                        className="rounded-xl border-[#e0d6cc] bg-white px-4 py-1.5 text-xs font-medium text-[#1c0d06] hover:bg-[#f7f4f0] shadow-2xs h-auto"
                      >
                        Add field
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {fields.map((field, i) => (
                      <div
                        key={`${field.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#e0d6cc] bg-white p-2.5"
                      >
                        <span className="text-sm font-medium text-[#1c0d06] px-1 truncate flex-1">
                          {field.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={field.fieldType}
                            onChange={(e) => retypeField(i, e.target.value as FieldType)}
                            className="rounded-lg border border-[#e0d6cc] bg-white px-2.5 py-1 text-xs text-[#1c0d06] outline-none"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeField(i)}
                            className="text-[#9e9083] hover:text-red-700 p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Inline Form when Adding Field */}
                    {isAddingField && (
                      <form
                        onSubmit={handleAddField}
                        className="flex flex-col sm:flex-row items-center gap-2 pt-1"
                      >
                        <input
                          type="text"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          placeholder="Field name"
                          autoFocus
                          className="w-full sm:flex-1 rounded-xl border border-[#e0d6cc] bg-white px-3 py-2 text-xs text-[#1c0d06] outline-none"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                            className="flex-1 sm:flex-none rounded-xl border border-[#e0d6cc] bg-white px-3 py-2 text-xs text-[#1c0d06] outline-none"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                            className="bg-[#1c0d06] text-xs text-white rounded-xl"
                          >
                            Add
                          </Button>
                          <button
                            type="button"
                            onClick={() => setIsAddingField(false)}
                            className="p-1 text-[#9e9083] hover:text-[#1c0d06]"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SAVE */}
            {step === 'save' && (
              <div className="flex flex-col gap-5">
                {/* Summary */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="text-base font-bold text-[#1c0d06]">
                      {name || 'Untitled project'}
                    </h3>
                  </div>
                  {description && <p className="text-xs text-[#7a6e65] ml-5">{description}</p>}
                </div>

                {/* Defined Fields Summary Table */}
                <div>
                  <p className="text-xs font-semibold text-[#8c7a6b] mb-2">Fields</p>
                  <div className="divide-y divide-[#f0e6da]">
                    {fields.length === 0 ? (
                      <p className="py-2 text-xs text-[#8c7a6b]">No fields added.</p>
                    ) : (
                      fields.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between py-2.5 text-xs sm:text-sm"
                        >
                          <span className="font-medium text-[#1c0d06]">{f.name}</span>
                          <span className="text-[#9e9083]">{f.fieldType}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reminders Toggle Control */}
                <div>
                  <p className="text-xs font-semibold text-[#8c7a6b] mb-2">Reminders</p>
                  <div className="flex rounded-xl bg-[#ebdccb]/50 p-1">
                    {(['off', 'daily', 'weekly'] as const).map((option) => {
                      const active = reminder === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setReminder(option)}
                          className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all ${
                            active
                              ? 'bg-[#d9a74a] text-[#1c0d06] shadow-xs'
                              : 'text-[#7a6e65] hover:text-[#1c0d06]'
                          }`}
                        >
                          {option === 'off'
                            ? 'Off'
                            : option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#8c7a6b]">
                    {reminder === 'weekly' &&
                      'Weekly email reminder — change this any time in project settings'}
                    {reminder === 'daily' &&
                      'Daily email reminder — change this any time in project settings'}
                    {reminder === 'off' && 'Reminders turned off for this project'}
                  </p>
                </div>

                {createProject.isError && (
                  <p className="text-xs text-red-600">
                    {(createProject.error as Error)?.message || 'Failed to create project.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="p-4 sm:p-6 border-t border-[#f0e6da] bg-[#fffcf8]">
            {step === 'details' && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs font-medium text-[#1c0d06] hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => setStep('fields')}
                  className="bg-[#1c0d06] px-6 py-2 text-xs font-medium text-white hover:bg-[#382012] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 'fields' && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs font-medium text-[#1c0d06] hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('details')}
                    className="rounded-xl border-[#e0d6cc] bg-white px-5 py-2 text-xs font-medium text-[#1c0d06] hover:bg-[#f7f4f0]"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={fields.length === 0}
                    onClick={() => setStep('save')}
                    className="bg-[#1c0d06] px-6 py-2 text-xs font-medium text-white hover:bg-[#382012] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 'save' && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs font-medium text-[#1c0d06] hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('fields')}
                    disabled={createProject.isPending}
                    className="rounded-xl border-[#e0d6cc] bg-white px-4 py-2 text-xs font-medium text-[#1c0d06] hover:bg-[#f7f4f0]"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave(false)}
                    disabled={createProject.isPending}
                    className="rounded-xl border-[#e0d6cc] bg-white px-4 py-2 text-xs font-medium text-[#1c0d06] hover:bg-[#f7f4f0]"
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={createProject.isPending}
                    className="bg-[#1c0d06] px-5 py-2 text-xs font-medium text-white hover:bg-[#382012] rounded-xl"
                  >
                    {createProject.isPending ? 'Saving…' : 'Save and log first entry'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
