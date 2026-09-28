import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldType } from '@/lib/field-types';
import { api } from '@/lib/api';
import type { Project } from '@/types';
import { toast } from '@/lib/toast';
import ProjectsPage from './ProjectsPage';

export const LAST_PROJECT_KEY = 'last_selected_project_id';

type Step = 'details' | 'fields' | 'save';

const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'fields', label: 'Fields' },
  { key: 'save', label: 'Save' },
];

const COLOR_OPTIONS = [
  { label: 'Amber', hex: '#d4a373' },
  { label: 'Gold', hex: '#c9b559' },
  { label: 'Olive Green', hex: '#7a9e6b' },
  { label: 'Purple', hex: '#8c709c' },
  { label: 'Slate Blue', hex: '#6b8fad' },
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
    onError: (error) => toast.error(error),
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
    <div className="relative min-h-screen bg-paper">
      {/* Background Projects page (Blurred on desktop modal view) */}
      <div
        className="pointer-events-none select-none opacity-40 filter blur-[1px] hidden sm:block"
        aria-hidden="true"
      >
        <ProjectsPage />
      </div>

      {/* Responsive Dialog Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper sm:bg-espresso/50 sm:p-6">
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[720px] sm:rounded-2xl bg-paper sm:shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Header & Stepper Progress */}
          <div className="p-4 pb-2 sm:px-8 sm:pt-8 sm:pb-2 bg-paper">
            {/* Mobile Header Navigation */}
            <div className="flex items-center justify-between mb-4 sm:hidden">
              <button
                type="button"
                onClick={handleTopBack}
                className="p-1 -ml-1 text-cocoa"
                aria-label="Back"
              >
                <ChevronLeft size={22} />
              </button>
              <h2 className="text-base font-bold text-espresso text-center flex-1">
                Create project
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm font-medium text-clay"
              >
                Cancel
              </button>
            </div>

            {/* Desktop Header Title */}
            <h2 className="hidden sm:block text-lg font-bold text-espresso mb-4">Create project</h2>

            {/* Step Indicators */}
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-gold' : 'bg-cream'}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`flex-1 text-center text-[11px] ${
                      i === stepIndex ? 'font-bold text-cocoa' : 'font-normal text-clay'
                    }`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:px-8 sm:py-6 space-y-6">
            {/* STEP 1: DETAILS */}
            {step === 'details' && (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Data Structures Revision"
                    className="w-full rounded-lg border border-line bg-white min-h-10 px-3 py-2 text-sm text-espresso outline-none focus:border-gold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Weekly problem sets and past-paper drills"
                    className="w-full rounded-lg border border-line bg-white min-h-10 px-3 py-2 text-sm text-espresso outline-none focus:border-gold resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-cocoa mb-2">Colour</label>
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
                            isSelected ? 'ring-2 ring-espresso ring-offset-2 scale-105' : ''
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
                  <p className="text-xs font-semibold text-espresso">Start from a template</p>
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
                              ? 'border-2 border-gold bg-white shadow-xs'
                              : 'border border-line bg-white hover:border-line-strong'
                          }`}
                        >
                          <p className="font-bold text-sm text-espresso">{t.name}</p>
                          {t.fields.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {t.fields.map((field) => (
                                <p key={field.name} className="text-xs text-clay">
                                  {field.name} —{' '}
                                  <span className="text-clay">
                                    {FIELD_TYPE_LABELS[field.fieldType]}
                                  </span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-clay">
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
                    <p className="text-xs font-semibold text-espresso">Custom fields</p>
                    {!isAddingField && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddingField(true)}
                        className="rounded-xl border-line bg-white px-4 py-1.5 text-xs font-medium text-espresso hover:bg-canvas shadow-2xs h-auto"
                      >
                        Add field
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {fields.map((field, i) => (
                      <div
                        key={`${field.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-2.5"
                      >
                        <span className="text-sm font-medium text-espresso px-1 truncate flex-1">
                          {field.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={field.fieldType}
                            onChange={(e) => retypeField(i, e.target.value as FieldType)}
                            className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-espresso outline-none"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {FIELD_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeField(i)}
                            className="text-clay hover:text-error p-1"
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
                          className="w-full sm:flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs text-espresso outline-none"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                            className="flex-1 sm:flex-none rounded-lg border border-line bg-white px-3 py-2 text-xs text-espresso outline-none"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {FIELD_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                            className="bg-espresso text-xs text-white rounded-xl"
                          >
                            Add
                          </Button>
                          <button
                            type="button"
                            onClick={() => setIsAddingField(false)}
                            className="p-1 text-clay hover:text-espresso"
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
                    <h3 className="text-base font-bold text-espresso">
                      {name || 'Untitled project'}
                    </h3>
                  </div>
                  {description && <p className="text-xs text-clay ml-5">{description}</p>}
                </div>

                {/* Defined Fields Summary Table */}
                <div>
                  <p className="text-xs font-semibold text-clay mb-2">Fields</p>
                  <div className="divide-y divide-cream">
                    {fields.length === 0 ? (
                      <p className="py-2 text-xs text-clay">No fields added.</p>
                    ) : (
                      fields.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between py-2.5 text-xs sm:text-sm"
                        >
                          <span className="font-medium text-espresso">{f.name}</span>
                          <span className="text-clay">{FIELD_TYPE_LABELS[f.fieldType]}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reminders Toggle Control */}
                <div>
                  <p className="text-xs font-semibold text-clay mb-2">Reminders</p>
                  <div className="flex rounded-xl bg-cream/50 p-1">
                    {(['off', 'daily', 'weekly'] as const).map((option) => {
                      const active = reminder === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setReminder(option)}
                          className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-all ${
                            active
                              ? 'bg-gold text-espresso shadow-xs'
                              : 'text-clay hover:text-espresso'
                          }`}
                        >
                          {option === 'off'
                            ? 'Off'
                            : option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-clay">
                    {reminder === 'weekly' &&
                      'Weekly email reminder — change this any time in project settings'}
                    {reminder === 'daily' &&
                      'Daily email reminder — change this any time in project settings'}
                    {reminder === 'off' && 'Reminders turned off for this project'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="mx-4 border-t border-cream bg-paper py-4 sm:mx-8 sm:pt-6 sm:pb-8">
            {step === 'details' && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs font-medium text-espresso hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => setStep('fields')}
                  className="bg-espresso px-6 py-2 text-xs font-medium text-white hover:bg-deep rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="text-xs font-medium text-espresso hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('details')}
                    className="rounded-xl border-line bg-white px-5 py-2 text-xs font-medium text-espresso hover:bg-canvas"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={fields.length === 0}
                    onClick={() => setStep('save')}
                    className="bg-espresso px-6 py-2 text-xs font-medium text-white hover:bg-deep rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="text-xs font-medium text-espresso hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('fields')}
                    disabled={createProject.isPending}
                    className="rounded-xl border-line bg-white px-4 py-2 text-xs font-medium text-espresso hover:bg-canvas"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave(false)}
                    disabled={createProject.isPending}
                    className="rounded-xl border-line bg-white px-4 py-2 text-xs font-medium text-espresso hover:bg-canvas"
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={createProject.isPending}
                    className="bg-espresso px-5 py-2 text-xs font-medium text-white hover:bg-deep rounded-xl"
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
