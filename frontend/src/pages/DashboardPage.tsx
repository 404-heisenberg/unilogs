import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Folder,
  FileText,
  User as UserIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Clock,
  FolderPlus,
} from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface CustomLogField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'number' | 'duration';
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  _count?: {
    entries: number;
  };
}

export interface Entry {
  id: number;
  projectId: number;
  date: string;
  createdAt: string;
  content: CustomLogField[];
  project?: {
    id: number;
    name: string;
  };
}

// ==========================================
// SUB-COMPONENT: SIDEBAR NAVIGATION
// ==========================================

interface SidebarNavProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isCollapsed,
  onToggleCollapse,
  onLogout,
}) => {
  return (
    <aside
      className={`flex flex-col justify-between border-r-2 border-[#d4af37] bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div>
        <header className="flex h-20 items-center justify-between border-b border-[#d4af37]/30 px-4">
          {!isCollapsed && (
            <h1 className="text-xl font-bold tracking-wider text-[#e6c687]">UNILOGS</h1>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-2 text-[#e6c687] hover:bg-[#2a150a] focus:outline-none"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </header>

        <nav className="p-4">
          <ul className="flex flex-col gap-2">
            <li>
              <Link
                to="/dashboard"
                className="flex w-full items-center gap-3 rounded-md bg-[#d4a373] p-3 font-semibold text-[#1c0d06] transition-colors"
              >
                <LayoutDashboard size={20} className="shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <Folder size={20} className="shrink-0" />
                {!isCollapsed && <span>Projects</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/entries"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <FileText size={20} className="shrink-0" />
                {!isCollapsed && <span>All Entries</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <UserIcon size={20} className="shrink-0" />
                {!isCollapsed && <span>Profile Information</span>}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <footer className="border-t border-[#d4af37]/30 p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </footer>
    </aside>
  );
};

// ==========================================
// SUB-COMPONENT: ANALYTICS OVERVIEW
// ==========================================

interface AnalyticsOverviewProps {
  totalHoursLogged: number;
  projectsCount: number;
  entriesCount: number;
  isLoading: boolean;
}

export const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({
  totalHoursLogged,
  projectsCount,
  entriesCount,
  isLoading,
}) => {
  const navigate = useNavigate();

  return (
    <section className="flex w-full flex-col rounded-xl border-2 border-[#d4a373] bg-white p-6 shadow-md">
      <h3 className="text-xl font-bold text-[#1c0d06]">Analytics Overview</h3>
      <p className="mt-1 border-b border-[#d4a373]/30 pb-3 mb-4 text-xs font-medium text-[#7a5230]">
        Summary: You currently have <strong>{projectsCount} active project(s)</strong> and{' '}
        <strong>{entriesCount} total logged entry/entries</strong>.
      </p>

      {isLoading ? (
        <div className="py-6 text-center text-sm font-medium text-[#7a5230]">
          Loading analytics data…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center rounded-lg border border-[#d4a373]/40 bg-[#f5ebe0] p-4 text-center">
            <span className="text-3xl font-extrabold text-[#1c0d06]">{totalHoursLogged} hrs</span>
            <span className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
              <Clock size={12} /> Logged Total
            </span>
          </div>

          <div
            onClick={() => navigate('/projects')}
            className="flex cursor-pointer flex-col items-center rounded-lg border border-[#d4a373]/40 bg-[#f5ebe0] p-4 text-center transition-colors hover:bg-[#e6c687]/30"
          >
            <span className="text-3xl font-extrabold text-[#1c0d06]">{projectsCount}</span>
            <span className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
              <Folder size={12} /> Active Projects
            </span>
          </div>

          <div
            onClick={() => navigate('/entries')}
            className="flex cursor-pointer flex-col items-center rounded-lg border border-[#d4a373]/40 bg-[#f5ebe0] p-4 text-center transition-colors hover:bg-[#e6c687]/30"
          >
            <span className="text-3xl font-extrabold text-[#1c0d06]">{entriesCount}</span>
            <span className="mt-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
              <FileText size={12} /> Total Entries
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

// ==========================================
// SUB-COMPONENT: QUICK LOG FORM
// ==========================================

interface QuickLogFormProps {
  projectsList: Project[];
  onEntrySaved: () => Promise<void>;
}

export const QuickLogForm: React.FC<QuickLogFormProps> = ({ projectsList, onEntrySaved }) => {
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState(false);

  const [customFields, setCustomFields] = useState<CustomLogField[]>([
    { id: 'field_1', label: 'Category / Activity', value: '', type: 'text' },
    { id: 'field_2', label: 'Detailed Summary & Progress', value: '', type: 'textarea' },
    { id: 'field_3', label: 'Hours Spent', value: '', type: 'duration' },
  ]);

  const parseDuration = (val: string) => {
    const hMatch = val.match(/(\d+)\s*h/i);
    const mMatch = val.match(/(\d+)\s*m/i);
    return {
      hours: hMatch ? hMatch[1] : '',
      mins: mMatch ? mMatch[1] : '',
    };
  };

  const handleCustomFieldChange = (
    id: string,
    key: 'label' | 'value' | 'type',
    newValue: string,
  ) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.id === id) {
          if (key === 'type' && field.type !== newValue) {
            return { ...field, [key]: newValue as CustomLogField['type'], value: '' };
          }
          return { ...field, [key]: newValue };
        }
        return field;
      }),
    );
  };

  const handleAddCustomField = () => {
    const newId = `field_${Date.now()}`;
    setCustomFields((prev) => [
      ...prev,
      { id: newId, label: 'Additional Detail', value: '', type: 'text' },
    ]);
  };

  const handleRemoveCustomField = (id: string) => {
    if (customFields.length <= 1) return;
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  };

  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const projectIdInt = parseInt(selectedProject, 10);
    if (isNaN(projectIdInt)) return;

    const payload = {
      projectId: projectIdInt,
      date: entryDate,
      content: customFields.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value,
        type: f.type,
      })),
    };

    try {
      setIsSubmittingLog(true);
      await api.post('/api/entries', payload);
      await onEntrySaved();

      setSelectedProject('');
      setCustomFields((prev) => prev.map((f) => ({ ...f, value: '' })));
      setLogSuccessMessage(true);
      setTimeout(() => setLogSuccessMessage(false), 3500);
    } catch (err) {
      console.error('Error saving entry:', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  return (
    <section className="flex w-full flex-col rounded-xl border-2 border-[#d4a373] bg-white p-8 shadow-md">
      <header className="mb-4 text-center">
        <h3 className="text-2xl font-bold text-[#1c0d06]">Log a New Entry</h3>
        <p className="text-xs text-[#7a5230]">
          Customize field names and choose appropriate input data types for your logging needs.
        </p>
      </header>

      {logSuccessMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-300 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600" />
          Entry saved successfully! Your analytics have been updated.
        </div>
      )}

      <form onSubmit={handleQuickLogSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-[#1c0d06]">
            1. Date
          </label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold uppercase tracking-wide text-[#1c0d06]">
            2. Select Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
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
        </div>

        {customFields.map((field, index) => {
          const duration = parseDuration(field.value);

          return (
            <div key={field.id} className="flex flex-col gap-2 border-t border-[#d4a373]/20 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                  <span className="text-xs font-bold uppercase text-[#7a5230] shrink-0">
                    {index + 3}. Name:
                  </span>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleCustomFieldChange(field.id, 'label', e.target.value)}
                    className="w-full rounded border border-[#d4a373] bg-white px-2 py-1 text-xs font-bold text-[#1c0d06] focus:outline-none focus:ring-1 focus:ring-[#d4a373]"
                    placeholder="Field label..."
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-[10px] font-bold uppercase text-[#7a5230]">Type:</label>
                  <select
                    value={field.type}
                    onChange={(e) =>
                      handleCustomFieldChange(
                        field.id,
                        'type',
                        e.target.value as CustomLogField['type'],
                      )
                    }
                    className="rounded border border-[#d4a373] bg-[#f5ebe0] px-2 py-1 text-xs font-bold text-[#1c0d06] focus:outline-none"
                  >
                    <option value="text">Text (Single Line)</option>
                    <option value="textarea">Text Area (Multi-Line)</option>
                    <option value="number">Number Only</option>
                    <option value="duration">Time Spent (Hours & Mins)</option>
                  </select>

                  {customFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(field.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Remove field"
                    >
                      <Trash2 size={14} />
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
                  className="min-h-[70px] w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none resize-y"
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
                  className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
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
                        const m = duration.mins;
                        const valStr = !h && !m ? '' : `${h || '0'}h ${m || '0'}m`;
                        handleCustomFieldChange(field.id, 'value', valStr);
                      }}
                      className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-3 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
                    />
                    <span className="text-xs font-bold text-[#7a5230]">hrs</span>
                  </div>

                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={duration.mins}
                      onChange={(e) => {
                        const rawM = e.target.value.replace(/[^0-9]/g, '');
                        let mNum = parseInt(rawM, 10);
                        if (!isNaN(mNum) && mNum > 59) mNum = 59;
                        const m = isNaN(mNum) ? '' : mNum.toString();
                        const h = duration.hours;
                        const valStr = !h && !m ? '' : `${h || '0'}h ${m || '0'}m`;
                        handleCustomFieldChange(field.id, 'value', valStr);
                      }}
                      className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-3 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
                    />
                    <span className="text-xs font-bold text-[#7a5230]">mins</span>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={`Enter ${field.label}...`}
                  value={field.value}
                  onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)}
                  className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
                />
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddCustomField}
          className="self-start text-xs font-bold text-[#7a5230] hover:text-[#1c0d06] flex items-center gap-1"
        >
          <Plus size={14} /> Add Another Field
        </button>

        <button
          type="submit"
          disabled={projectsList.length === 0 || isSubmittingLog}
          className="mt-2 w-full rounded-md bg-[#1c0d06] py-3 text-sm font-bold text-[#f5ebe0] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmittingLog ? 'Saving Log Entry…' : 'Save Log Entry'}
        </button>
      </form>
    </section>
  );
};

// ==========================================
// SUB-COMPONENT: CREATE PROJECT MODAL
// ==========================================

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectDescInput, setProjectDescInput] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  if (!isOpen) return null;

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNameInput.trim()) return;

    try {
      setIsCreatingProject(true);
      await api.post<Project>('/api/projects', {
        name: projectNameInput.trim(),
        description: projectDescInput.trim(),
      });
      await onProjectCreated();
      setProjectNameInput('');
      setProjectDescInput('');
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border-2 border-[#d4a373] bg-[#f5ebe0] p-6 text-[#1c0d06] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#d4a373]/40 pb-3">
          <h3 className="flex items-center gap-2 text-xl font-bold text-[#1c0d06]">
            <FolderPlus size={20} /> Create New Project
          </h3>
          <button type="button" onClick={onClose} className="text-[#1c0d06] hover:opacity-75">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleCreateProjectSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs font-bold text-[#1c0d06]">
            PROJECT TITLE *
            <input
              type="text"
              placeholder="e.g. Operating Systems Lab"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              className="rounded-md border border-[#d4a373] bg-white px-3 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-bold text-[#1c0d06]">
            DESCRIPTION (OPTIONAL)
            <textarea
              rows={2}
              placeholder="Brief description..."
              value={projectDescInput}
              onChange={(e) => setProjectDescInput(e.target.value)}
              className="rounded-md border border-[#d4a373] bg-white px-3 py-2 text-sm text-[#1c0d06] focus:outline-none"
            />
          </label>

          <footer className="mt-2 flex justify-end gap-3 border-t border-[#d4a373]/40 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#d4a373] px-4 py-2 text-xs font-bold text-[#1c0d06] hover:bg-[#e6c687]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingProject}
              className="rounded-md bg-[#1c0d06] px-5 py-2 text-xs font-bold text-[#f5ebe0] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isCreatingProject ? 'Creating…' : 'Create Project'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// MAIN CONTAINER: DASHBOARD PAGE
// ==========================================

export const DashboardPage: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Session & User Resolution
  const { data: sessionData } = useSession();
  const userObj = sessionData?.user || (sessionData as Record<string, unknown>);

  const userName =
    (typeof userObj?.name === 'string' && userObj.name) ||
    (typeof userObj?.fullName === 'string' && userObj.fullName) ||
    (typeof userObj?.full_name === 'string' && userObj.full_name) ||
    (typeof userObj?.username === 'string' && userObj.username) ||
    (typeof userObj?.email === 'string' ? userObj.email.split('@')[0] : 'User');

  const userInitial = userName.charAt(0).toUpperCase();

  // Dynamic Projects & Analytics State
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [entriesList, setEntriesList] = useState<Entry[]>([]);
  const [totalHoursLogged, setTotalHoursLogged] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const navigate = useNavigate();

  const calculateMinutesFromDuration = (val: string): number => {
    if (!val) return 0;
    const hMatch = val.match(/(\d+)\s*h/i);
    const mMatch = val.match(/(\d+)\s*m/i);
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    return hours * 60 + mins;
  };

  const fetchData = useCallback(async () => {
    try {
      const [projectsData, entriesData] = await Promise.all([
        api.get<Project[]>('/api/projects').catch(() => []),
        api.get<Entry[]>('/api/entries').catch(() => []),
      ]);

      if (Array.isArray(projectsData)) {
        setProjectsList(projectsData);
      }

      if (Array.isArray(entriesData)) {
        setEntriesList(entriesData);

        let totalMinutes = 0;
        entriesData.forEach((entry) => {
          if (Array.isArray(entry.content)) {
            const durFields = entry.content.filter((f) => f.type === 'duration');
            durFields.forEach((field) => {
              if (field?.value) {
                totalMinutes += calculateMinutesFromDuration(field.value);
              }
            });
          }
        });
        setTotalHoursLogged(parseFloat((totalMinutes / 60).toFixed(1)));
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };

    loadData();
  }, [fetchData]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Redirect regardless of API status
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      <SidebarNav
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={handleLogout}
      />

      <main className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        <header className="flex h-20 items-center justify-between border-b-2 border-[#d4af37] bg-[#1c0d06] px-8 text-[#f5ebe0] shadow-md">
          <h2 className="text-2xl font-bold tracking-tight text-[#e6c687]">WELCOME</h2>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
              {userInitial}
            </span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-12">
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <AnalyticsOverview
              totalHoursLogged={totalHoursLogged}
              projectsCount={projectsList.length}
              entriesCount={entriesList.length}
              isLoading={isLoading}
            />

            <section className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-[#d4a373] bg-white p-8 text-center shadow-md">
              <h3 className="text-2xl font-bold text-[#1c0d06]">Create New Project</h3>
              <p className="mt-1 text-sm font-medium text-[#7a5230]">
                Set up a new workspace to organize your log entries and study sessions.
              </p>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#1c0d06] px-6 py-2.5 font-semibold text-[#f5ebe0] transition-opacity hover:opacity-90"
              >
                <Plus size={18} /> Start New Project
              </button>
            </section>

            <QuickLogForm projectsList={projectsList} onEntrySaved={fetchData} />
          </div>
        </div>
      </main>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectCreated={fetchData}
      />
    </div>
  );
};

export default DashboardPage;
