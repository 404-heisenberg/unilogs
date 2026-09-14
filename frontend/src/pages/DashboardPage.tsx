import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Flame,
  Folder,
  Award,
  Plus,
  Trash2,
  LayoutDashboard,
  FolderKanban,
  FileText,
  PlusCircle,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { getStatsSummary, getFrequencyStats, api } from '../lib/api';
import type { FieldDefinition } from '@/types';

export type FieldType = 'text' | 'textarea' | 'number' | 'duration';

export interface ProjectFieldSchema {
  id: string;
  label: string;
  type: FieldType;
}

export interface ProjectItem {
  id: string;
  name: string;
  schema?: ProjectFieldSchema[];
}

const BAR_COLORS = ['#c5a059', '#b8860b', '#d4af37', '#dfb15b', '#e6c687'];

export interface CustomLogField {
  id: string;
  label: string;
  type: FieldType;
  value: string;
  isPreset?: boolean;
}

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  user?: { name: string; email: string };
  onSignOut?: () => void;
}

export function Sidebar({ currentRoute, onNavigate, user, onSignOut }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'new-project', label: 'New Project', icon: PlusCircle },
    { id: 'entries', label: 'Entries', icon: FileText },
    { id: 'new-entry', label: 'New Entry', icon: Plus },
  ];

  return (
    <aside
      className={`relative flex flex-col justify-between bg-[#110f0e] text-[#fbf7f0] transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      } min-h-screen border-r border-stone-800 p-4`}
    >
      <div>
        <div className="flex items-center justify-between mb-8 px-2 pt-2">
          {!isCollapsed && (
            <span className="text-xl font-bold tracking-tight text-amber-500">UniLogs</span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1c1917] text-stone-300 hover:bg-[#292524] hover:text-white transition-colors cursor-pointer ml-auto"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer w-full ${
                  isActive
                    ? 'bg-amber-600/20 text-amber-500 font-semibold'
                    : 'text-stone-300 hover:bg-[#1c1917] hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-stone-800">
        {!isCollapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[#1c1917]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/20 text-amber-500 font-bold">
              {user.name ? user.name[0].toUpperCase() : <User className="h-4 w-4" />}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-bold text-stone-200">{user.name}</p>
              <p className="truncate text-[10px] text-stone-400">{user.email}</p>
            </div>
          </div>
        )}
        {isCollapsed && user && (
          <div className="flex justify-center py-2" title={`${user.name} (${user.email})`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600/20 text-amber-500 font-bold">
              {user.name ? user.name[0].toUpperCase() : <User className="h-4 w-4" />}
            </div>
          </div>
        )}

        <button
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-stone-300 hover:bg-[#1c1917] hover:text-white transition-colors cursor-pointer w-full"
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>

        <button
          onClick={onSignOut}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer w-full"
          title={isCollapsed ? 'Sign out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

function CreateProjectCard() {
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const queryClient = useQueryClient();

  const createProjectMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => api.post('/api/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      setProjectName('');
      setProjectDescription('');
      setIsCreating(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = projectName.trim();
    if (!trimmedName) return;

    createProjectMutation.mutate({
      name: trimmedName,
      description: projectDescription.trim() || undefined,
    });
  };

  if (!isCreating) {
    return (
      <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-stone-900">Create New Project</h3>
        <p className="mt-1 text-sm font-medium text-stone-600">
          Set up a new workspace to organize your log entries and study sessions.
        </p>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg bg-[#1c0d06] px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Start New Project
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col">
      <h3 className="mb-4 text-xl font-bold text-stone-900">Create New Project</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
            Project Name <span className="text-amber-600">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. UniLogs Development"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
            Description <span className="text-xs font-normal text-stone-400">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Brief summary of what this project covers..."
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            className="w-full resize-y rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
          />
        </div>

        {createProjectMutation.isError && (
          <p className="text-xs text-red-600">Failed to create project. Please try again.</p>
        )}

        <div className="mt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setProjectName('');
              setProjectDescription('');
            }}
            className="cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProjectMutation.isPending || !projectName.trim()}
            className="cursor-pointer rounded-lg bg-[#b8860b] px-5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createProjectMutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [target, duration]);

  return value;
}

function heatColor(count: number, max: number) {
  if (count === 0) return 'bg-stone-300';
  const ratio = count / max;
  if (ratio <= 0.25) return 'bg-amber-200';
  if (ratio <= 0.5) return 'bg-amber-300';
  if (ratio <= 0.75) return 'bg-amber-500';
  return 'bg-[#b8860b]';
}

export default function DashboardSection() {
  const queryClient = useQueryClient();
  const [hoveredWeek, setHoveredWeek] = useState<{ weekStart: string; count: number } | null>(null);

  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [customFields, setCustomFields] = useState<CustomLogField[]>([
    { id: '1', label: 'Activity Details', type: 'textarea', value: '' },
    { id: '2', label: 'Time Spent', type: 'duration', value: '' },
  ]);

  const summaryQuery = useQuery({
    queryKey: ['stats-summary'],
    queryFn: getStatsSummary,
  });

  const frequencyQuery = useQuery({
    queryKey: ['stats-frequency'],
    queryFn: getFrequencyStats,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get<ProjectItem[]>('/api/projects'),
  });

  const fieldsQuery = useQuery({
    queryKey: ['field-definitions', selectedProject],
    queryFn: () =>
      api.get<FieldDefinition[]>(`/api/field-definitions?projectId=${selectedProject}`),
    enabled: !!selectedProject,
  });

  const hasPresetFields = !!fieldsQuery.data && fieldsQuery.data.length > 0;

  // Render-phase state synchronization replacing the useEffect hook to avoid cascading renders
  const [prevSelectedProject, setPrevSelectedProject] = useState(selectedProject);
  const [prevFieldsData, setPrevFieldsData] = useState(fieldsQuery.data);

  if (selectedProject !== prevSelectedProject || fieldsQuery.data !== prevFieldsData) {
    setPrevSelectedProject(selectedProject);
    setPrevFieldsData(fieldsQuery.data);

    if (!selectedProject || !fieldsQuery.data || fieldsQuery.data.length === 0) {
      setCustomFields([
        { id: '1', label: 'Activity Details', type: 'textarea', value: '' },
        { id: '2', label: 'Time Spent', type: 'duration', value: '' },
      ]);
    } else {
      setCustomFields((prev) =>
        fieldsQuery.data!.map((f) => {
          const existing = prev.find((p) => p.id === f.id.toString() || p.label === f.name);
          return {
            id: f.id.toString(),
            label: f.name,
            type: f.fieldType as CustomLogField['type'],
            value: existing ? existing.value : '',
            isPreset: true,
          };
        }),
      );
    }
  }

  const createEntryMutation = useMutation({
    mutationFn: (data: { projectId: number; date: string; content: Record<string, string> }) =>
      api.post('/api/entries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stats-frequency'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['field-definitions'] });
      setCustomFields((prev) => prev.map((f) => ({ ...f, value: '' })));
    },
  });

  const summary = summaryQuery.data;
  const hasEntries = !!summary && summary.totalHours > 0 && summary.perProject.length > 0;
  const topProject = hasEntries
    ? [...summary!.perProject].sort((a, b) => b.totalHours - a.totalHours)[0]
    : null;

  const projectsList: ProjectItem[] =
    projectsQuery.data ??
    (summary?.perProject
      ? summary.perProject.map((p) => ({ id: p.projectName, name: p.projectName, schema: [] }))
      : []);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
  };

  const addCustomField = () => {
    if (hasPresetFields) return;
    setCustomFields((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: `Field ${prev.length + 1}`,
        type: 'text',
        value: '',
      },
    ]);
  };

  const removeCustomField = (id: string) => {
    if (hasPresetFields) return;
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  };

  const streakCount = useCountUp(summary?.streak ?? 0);
  const totalHoursCount = useCountUp(summary?.totalHours ?? 0);
  const topHoursCount = useCountUp(topProject?.totalHours ?? 0);

  const parseDuration = (val: string) => {
    const hMatch = val.match(/(\d+)h/);
    const mMatch = val.match(/(\d+)m/);
    return {
      hours: hMatch ? hMatch[1] : '',
      mins: mMatch ? mMatch[1] : '',
    };
  };

  const handleCustomFieldChange = (id: string, key: keyof CustomLogField, val: string) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, [key]: val } : field)),
    );
  };

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    const content: Record<string, string> = {};
    customFields.forEach((field) => {
      content[field.label] = field.value;
    });
    createEntryMutation.mutate({
      projectId: Number(selectedProject),
      date: entryDate,
      content,
    });
  };

  if (summaryQuery.isLoading || frequencyQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-300" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="h-52 animate-pulse rounded-2xl bg-stone-200 md:col-span-2" />
          <div className="h-52 animate-pulse rounded-2xl bg-stone-200 md:col-span-1" />
          <div className="h-52 animate-pulse rounded-2xl bg-stone-200 md:col-span-2" />
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    );
  }

  if (summaryQuery.isError || frequencyQuery.isError) {
    return (
      <div className="flex h-64 items-center justify-center text-stone-900 w-full">
        <div className="text-center">
          <p className="text-lg font-semibold text-stone-900">Couldn't load your stats</p>
          <p className="mt-1 text-sm text-stone-600">Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const frequency = frequencyQuery.data!;
  const maxWeekCount = Math.max(1, ...frequency.weekly.map((w) => w.count));

  if (!hasEntries) {
    return (
      <div className="flex flex-col gap-8 w-full">
        <CreateProjectCard />

        <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col">
          <header className="mb-4">
            <h3 className="text-2xl font-bold text-stone-900">Log a New Entry</h3>
            <p className="text-xs text-stone-600">
              {hasPresetFields
                ? 'Fields are predefined for this project and cannot be modified here.'
                : 'Customize field names and choose appropriate input data types for your logging needs.'}
            </p>
          </header>
          <form onSubmit={handleQuickLog} className="flex flex-col gap-5">
            <article className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
                1. Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                required
              />
            </article>
            <article className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
                2. Select Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                required
              >
                <option value="" disabled>
                  {projectsList.length > 0
                    ? 'Select target project...'
                    : 'No projects found. Create a project above first.'}
                </option>
                {projectsList.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </article>
            {customFields.map((field, index) => {
              const duration = parseDuration(field.value);
              return (
                <article
                  key={field.id}
                  className="flex flex-col gap-2 border-t border-stone-300/60 pt-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-[200px] flex-1 items-center gap-2">
                      <span className="shrink-0 text-xs font-bold uppercase text-stone-600">
                        {index + 3}. Name:
                      </span>
                      <input
                        type="text"
                        value={field.label}
                        disabled={hasPresetFields}
                        onChange={(e) => handleCustomFieldChange(field.id, 'label', e.target.value)}
                        className={`w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none ${hasPresetFields ? 'cursor-not-allowed opacity-70' : ''}`}
                        placeholder="Field label..."
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold uppercase text-stone-600">
                          Type:
                        </label>
                        <select
                          value={field.type}
                          disabled={hasPresetFields}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              field.id,
                              'type',
                              e.target.value as CustomLogField['type'],
                            )
                          }
                          className={`rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none ${hasPresetFields ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          <option value="text">Text (Single Line)</option>
                          <option value="textarea">Text Area (Multi-Line)</option>
                          <option value="number">Number Only</option>
                          <option value="duration">Time Spent (Hours & Mins)</option>
                        </select>
                      </div>
                      {!hasPresetFields && customFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCustomField(field.id)}
                          title="Remove field"
                          className="cursor-pointer rounded p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      placeholder={`Enter ${field.label}...`}
                      value={field.value}
                      onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                      className="min-h-[70px] w-full resize-y rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      step="any"
                      placeholder={`Enter numeric ${field.label}...`}
                      value={field.value}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        handleCustomFieldChange(field.id, 'value', val);
                      }}
                      className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                    />
                  ) : field.type === 'duration' ? (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={duration.hours}
                          onChange={(e) => {
                            const h = e.target.value.replace(/[^0-9]/g, '');
                            const m = duration.mins || '0';
                            handleCustomFieldChange(field.id, 'value', `${h || '0'}h ${m}m`);
                          }}
                          className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-stone-600">hrs</span>
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="0"
                          value={duration.mins}
                          onChange={(e) => {
                            let m = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                            if (isNaN(m)) m = 0;
                            if (m > 59) m = 59;
                            const h = duration.hours || '0';
                            handleCustomFieldChange(field.id, 'value', `${h}h ${m}m`);
                          }}
                          className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-stone-600">mins</span>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={`Enter ${field.label}...`}
                      value={field.value}
                      onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                      className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                    />
                  )}
                </article>
              );
            })}
            {!hasPresetFields && (
              <button
                type="button"
                onClick={addCustomField}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#b8860b]/40 bg-[#f5ebe0]/50 py-2.5 text-xs font-bold text-[#b8860b] transition-colors hover:border-[#b8860b] hover:bg-amber-50/50 hover:text-[#966d09]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Custom Field
              </button>
            )}
            {hasPresetFields && (
              <p className="text-center text-xs italic text-stone-500">
                Fields are predefined for this project. You cannot add or remove fields here.
              </p>
            )}
            <button
              type="submit"
              disabled={projectsList.length === 0 || createEntryMutation.isPending}
              className="mt-2 w-full cursor-pointer rounded-2xl bg-[#1c0d06] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createEntryMutation.isPending ? 'Saving…' : 'Save Log Entry'}
            </button>
          </form>
        </div>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Flame className="mb-4 h-10 w-10 text-amber-600" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-stone-900">No entries yet</p>
          <p className="mt-1 max-w-xs text-sm text-stone-600">
            Log your first entry to see your hours, streak, and activity here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full">
      <CreateProjectCard />

      <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col">
        <header className="mb-4">
          <h3 className="text-2xl font-bold text-stone-900">Log a New Entry</h3>
          <p className="text-xs text-stone-600">
            {hasPresetFields
              ? 'Fields are predefined for this project and cannot be modified here.'
              : 'Define what an entry for a project looks like.'}
          </p>
        </header>
        <form onSubmit={handleQuickLog} className="flex flex-col gap-5">
          <article className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
              1. Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
              required
            />
          </article>
          <article className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-stone-600">
              2. Select Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => handleProjectSelect(e.target.value)}
              className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
              required
            >
              <option value="" disabled>
                {projectsList.length > 0
                  ? 'Select target project...'
                  : 'No projects found. Create a project above first.'}
              </option>
              {projectsList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </article>
          {customFields.map((field, index) => {
            const duration = parseDuration(field.value);
            return (
              <article
                key={field.id}
                className="flex flex-col gap-2 border-t border-stone-300/60 pt-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-[200px] flex-1 items-center gap-2">
                    <span className="shrink-0 text-xs font-bold uppercase text-stone-600">
                      {index + 3}. Name:
                    </span>
                    <input
                      type="text"
                      value={field.label}
                      disabled={hasPresetFields}
                      onChange={(e) => handleCustomFieldChange(field.id, 'label', e.target.value)}
                      className={`w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none ${hasPresetFields ? 'cursor-not-allowed opacity-70' : ''}`}
                      placeholder="Field label..."
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold uppercase text-stone-600">
                        Type:
                      </label>
                      <select
                        value={field.type}
                        disabled={hasPresetFields}
                        onChange={(e) =>
                          handleCustomFieldChange(
                            field.id,
                            'type',
                            e.target.value as CustomLogField['type'],
                          )
                        }
                        className={`rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-1.5 text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none ${hasPresetFields ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        <option value="text">Text (Single Line)</option>
                        <option value="textarea">Text Area (Multi-Line)</option>
                        <option value="number">Number Only</option>
                        <option value="duration">Time Spent (Hours & Mins)</option>
                      </select>
                    </div>
                    {!hasPresetFields && customFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id)}
                        title="Remove field"
                        className="cursor-pointer rounded p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    placeholder={`Enter ${field.label}...`}
                    value={field.value}
                    onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                    className="min-h-[70px] w-full resize-y rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="number"
                    step="any"
                    placeholder={`Enter numeric ${field.label}...`}
                    value={field.value}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      handleCustomFieldChange(field.id, 'value', val);
                    }}
                    className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                ) : field.type === 'duration' ? (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={duration.hours}
                        onChange={(e) => {
                          const h = e.target.value.replace(/[^0-9]/g, '');
                          const m = duration.mins || '0';
                          handleCustomFieldChange(field.id, 'value', `${h || '0'}h ${m}m`);
                        }}
                        className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-stone-600">hrs</span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        placeholder="0"
                        value={duration.mins}
                        onChange={(e) => {
                          let m = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                          if (isNaN(m)) m = 0;
                          if (m > 59) m = 59;
                          const h = duration.hours || '0';
                          handleCustomFieldChange(field.id, 'value', `${h}h ${m}m`);
                        }}
                        className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-3 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-stone-600">mins</span>
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder={`Enter ${field.label}...`}
                    value={field.value}
                    onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                    className="w-full rounded-2xl border border-[#b8860b]/40 bg-[#f5ebe0]/50 px-4 py-2 text-sm font-semibold text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                )}
              </article>
            );
          })}
          {!hasPresetFields && (
            <button
              type="button"
              onClick={addCustomField}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#b8860b]/40 bg-[#f5ebe0]/50 py-2.5 text-xs font-bold text-[#b8860b] transition-colors hover:border-[#b8860b] hover:bg-amber-50/50 hover:text-[#966d09]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Field
            </button>
          )}
          {hasPresetFields && (
            <p className="text-center text-xs italic text-stone-500">
              Fields are predefined for this project. You cannot add or remove fields here.
            </p>
          )}
          <button
            type="submit"
            disabled={projectsList.length === 0 || createEntryMutation.isPending}
            className="mt-2 w-full cursor-pointer rounded-2xl bg-[#1c0d06] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createEntryMutation.isPending ? 'Saving…' : 'Save Log Entry'}
          </button>
        </form>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col justify-between md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Current Streak
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
          </div>
          <div className="my-4 flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-stone-900">{streakCount}</span>
            <span className="text-sm font-semibold text-stone-600">days active</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
            <div className="h-2 w-2 rounded-full bg-amber-600" />
            <span>Keep pushing your daily goals!</span>
          </div>
        </div>

        <div className="bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col justify-between md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Total Hours
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Folder className="h-5 w-5" />
            </div>
          </div>
          <div className="my-4">
            <span className="text-4xl font-black tracking-tight text-stone-900">
              {totalHoursCount}
            </span>
            <span className="ml-1 text-sm font-semibold text-stone-600">hrs</span>
          </div>
          <div className="text-xs font-medium text-stone-500">Across all logged entries</div>
        </div>

        <div className="bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col justify-between md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Top Project
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="my-4">
            <h4 className="truncate text-xl font-bold text-stone-900">
              {topProject ? topProject.projectName : 'No projects yet'}
            </h4>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-amber-600">
                {topHoursCount}
              </span>
              <span className="text-xs font-semibold text-stone-600">hours invested</span>
            </div>
          </div>
          <div className="text-xs font-medium text-stone-500">Your most focused workspace</div>
        </div>
      </div>

      {/* Hours per Project Chart */}
      <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-900">Hours per Project</h3>
          <span className="text-xs font-semibold uppercase text-stone-600">Distribution</span>
        </header>
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={summary?.perProject ?? []}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis
                dataKey="projectName"
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#d6d3d1' }}
              />
              <YAxis
                stroke="#78716c"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#d6d3d1' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(217, 119, 6, 0.05)' }}
                contentStyle={{
                  backgroundColor: '#f5ebe0',
                  borderColor: '#e7e5e4',
                  borderRadius: '8px',
                  color: '#1c1917',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="totalHours" radius={[4, 4, 0, 0]}>
                {summary?.perProject.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Frequency / Heatmap Grid */}
      <div className="mx-auto w-[calc(100%-20px)] bg-[#f5ebe0]/50 rounded-2xl border border-[#b8860b]/40 p-6 shadow-sm flex flex-col">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Activity Frequency</h3>
            <p className="text-xs text-stone-600">
              {hoveredWeek
                ? `Week of ${hoveredWeek.weekStart}: ${hoveredWeek.count} entries`
                : 'Weekly contribution history over time'}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase text-stone-600">Consistency</span>
        </header>
        <div className="flex flex-wrap gap-1.5 py-2">
          {frequency.weekly.map((week, index) => (
            <div
              key={index}
              onMouseEnter={() => setHoveredWeek({ weekStart: week.weekStart, count: week.count })}
              onMouseLeave={() => setHoveredWeek(null)}
              className={`h-4 w-4 rounded-sm transition-transform hover:scale-125 ${heatColor(week.count, maxWeekCount)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
