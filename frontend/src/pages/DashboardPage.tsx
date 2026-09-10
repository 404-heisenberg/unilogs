import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, api } from '../lib/api';

interface CustomLogField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'number' | 'duration';
}

interface Project {
  id: number;
  name: string;
  description?: string;
  _count?: {
    entries: number;
  };
}

interface EntryTag {
  tag: {
    id: number;
    name: string;
  };
}

interface Entry {
  id: number;
  projectId: number;
  date: string;
  createdAt: string;
  content: CustomLogField[];
  project?: {
    id: number;
    name: string;
  };
  tags?: EntryTag[];
}

export const DashboardPage: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'entries' | 'profile'>(
    'dashboard',
  );

  // Session & User Resolution
  const sessionResult = useSession();
  const userObj = sessionResult?.data?.user || (sessionResult?.data as any);

  const userName =
    userObj?.name ||
    userObj?.fullName ||
    userObj?.full_name ||
    userObj?.username ||
    (userObj?.email ? userObj.email.split('@')[0] : 'User');

  const userInitial = userName.charAt(0).toUpperCase();

  // Dynamic Projects & Analytics State
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [entriesList, setEntriesList] = useState<Entry[]>([]);
  const [totalHoursLogged, setTotalHoursLogged] = useState<number>(0);

  // Project Creation Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectDescInput, setProjectDescInput] = useState('');

  // Log Entry Form State
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedProject, setSelectedProject] = useState<string>('');

  const [customFields, setCustomFields] = useState<CustomLogField[]>([
    { id: 'field_1', label: 'Category / Activity', value: '', type: 'text' },
    { id: 'field_2', label: 'Detailed Summary & Progress', value: '', type: 'textarea' },
    { id: 'field_3', label: 'Hours Spent', value: '', type: 'duration' },
  ]);

  const navigate = useNavigate();

  // Parse duration string (e.g., "2h 30m") to minutes for calculations
  const calculateMinutesFromDuration = (val: string): number => {
    if (!val) return 0;
    const hMatch = val.match(/(\d+)\s*h/);
    const mMatch = val.match(/(\d+)\s*m/);
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    return hours * 60 + mins;
  };

  // Helper for rendering/updating duration inputs
  const parseDuration = (val: string) => {
    const hMatch = val.match(/(\d+)\s*h/);
    const mMatch = val.match(/(\d+)\s*m/);
    return {
      hours: hMatch ? hMatch[1] : '',
      mins: mMatch ? mMatch[1] : '',
    };
  };

  // Fetch Projects & Entries from PostgreSQL backend
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

        // Calculate total hours across all JSON content fields
        let totalMinutes = 0;
        entriesData.forEach((entry) => {
          if (Array.isArray(entry.content)) {
            const durField = entry.content.find((f) => f.type === 'duration');
            if (durField?.value) {
              totalMinutes += calculateMinutesFromDuration(durField.value);
            }
          }
        });
        setTotalHoursLogged(parseFloat((totalMinutes / 60).toFixed(1)));
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Proceed with redirect regardless of network status
    } finally {
      navigate('/login');
    }
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

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNameInput.trim()) return;

    try {
      await api.post<Project>('/api/projects', {
        name: projectNameInput.trim(),
        description: projectDescInput.trim(),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to create project:', err);
    }

    setProjectNameInput('');
    setProjectDescInput('');
    setIsProjectModalOpen(false);
  };

  // Submit Log Entry matching Prisma schema (projectId: Int, content: Json)
  const handleQuickLog = async (e: React.FormEvent) => {
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
      await api.post('/api/entries', payload);
      await fetchData(); // Refresh analytics and project lists
    } catch (err) {
      console.error('Error saving entry:', err);
    }

    setSelectedProject('');
    setCustomFields((prev) => prev.map((f) => ({ ...f, value: '' })));
  };

  return (
    <main className="flex min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      {/* Sidebar Navigation */}
      <aside
        className={`flex flex-col justify-between bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 border-r-2 border-[#d4af37] ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <section>
          <header className="flex h-20 items-center justify-between px-4 border-b border-[#d4af37]/30">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-bold tracking-wider text-[#e6c687]">UniLogs</h1>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="rounded-md p-2 text-[#e6c687] hover:bg-[#2a150a] focus:outline-none cursor-pointer"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </header>

          <nav className="p-4">
            <ul className="flex flex-col gap-2">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dashboard');
                    navigate('/dashboard');
                  }}
                  className={`flex w-full items-center gap-3 rounded-md p-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-[#d4a373] text-[#1c0d06]'
                      : 'text-[#f5ebe0] hover:bg-[#2a150a]'
                  }`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  {!isSidebarCollapsed && <span>Dashboard</span>}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('projects');
                    navigate('/projects');
                  }}
                  className={`flex w-full items-center gap-3 rounded-md p-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'projects'
                      ? 'bg-[#d4a373] text-[#1c0d06]'
                      : 'text-[#f5ebe0] hover:bg-[#2a150a]'
                  }`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  {!isSidebarCollapsed && <span>Projects</span>}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('entries');
                    navigate('/entries');
                  }}
                  className={`flex w-full items-center gap-3 rounded-md p-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'entries'
                      ? 'bg-[#d4a373] text-[#1c0d06]'
                      : 'text-[#f5ebe0] hover:bg-[#2a150a]'
                  }`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {!isSidebarCollapsed && <span>All Entries</span>}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('profile');
                    navigate('/profile');
                  }}
                  className={`flex w-full items-center gap-3 rounded-md p-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-[#d4a373] text-[#1c0d06]'
                      : 'text-[#f5ebe0] hover:bg-[#2a150a]'
                  }`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {!isSidebarCollapsed && <span>Profile Information</span>}
                </button>
              </li>
            </ul>
          </nav>
        </section>

        {/* Sidebar Footer with Logout Button */}
        <footer className="p-4 border-t border-[#d4af37]/30">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </footer>
      </aside>

      {/* Main Workspace */}
      <section className="flex flex-1 flex-col overflow-y-auto">
        {/* Top Header Bar */}
        <header className="flex h-20 items-center justify-between border-b-2 border-[#d4af37] bg-[#1c0d06] px-8 text-[#f5ebe0] shadow-md">
          <h2 className="text-2xl font-bold tracking-tight text-[#e6c687]">WELCOME</h2>
          <article className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
              {userInitial}
            </span>
          </article>
        </header>

        {/* Dashboard Content Workspace */}
        <section className="flex flex-1 flex-col items-center justify-center p-6 md:p-12">
          <section className="flex w-full max-w-3xl flex-col items-center gap-6">
            {/* Analytics Overview */}
            <section className="flex w-full flex-col rounded-xl border-2 border-[#d4a373] bg-white p-6 shadow-md">
              <h3 className="text-xl font-bold text-[#1c0d06]">Analytics Overview</h3>
              <p className="mt-1 text-xs font-medium text-[#7a5230] border-b border-[#d4a373]/30 pb-3 mb-4">
                Summary: You currently have <strong>{projectsList.length} active project(s)</strong>{' '}
                and <strong>{entriesList.length} total logged entry/entries</strong>.
              </p>
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <article className="flex flex-col items-center rounded-lg bg-[#f5ebe0] p-4 text-center border border-[#d4a373]/40">
                  <span className="text-3xl font-extrabold text-[#1c0d06]">
                    {totalHoursLogged} hrs
                  </span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
                    Logged Total
                  </span>
                </article>
                <article
                  onClick={() => navigate('/projects')}
                  className="flex flex-col items-center rounded-lg bg-[#f5ebe0] p-4 text-center border border-[#d4a373]/40 cursor-pointer hover:bg-[#e6c687]/30 transition-colors"
                >
                  <span className="text-3xl font-extrabold text-[#1c0d06]">
                    {projectsList.length}
                  </span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
                    Active Projects
                  </span>
                </article>
                <article
                  onClick={() => navigate('/entries')}
                  className="flex flex-col items-center rounded-lg bg-[#f5ebe0] p-4 text-center border border-[#d4a373]/40 cursor-pointer hover:bg-[#e6c687]/30 transition-colors"
                >
                  <span className="text-3xl font-extrabold text-[#1c0d06]">
                    {entriesList.length}
                  </span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#7a5230]">
                    Total Entries
                  </span>
                </article>
              </section>
            </section>

            {/* Create Project Section */}
            <section className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-[#d4a373] bg-white p-8 text-center shadow-md">
              <h3 className="text-2xl font-bold text-[#1c0d06]">Create New Project</h3>
              <p className="mt-1 text-sm font-medium text-[#7a5230]">
                Set up a new workspace to organize your log entries and study sessions.
              </p>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(true)}
                className="mt-4 rounded-md bg-[#1c0d06] px-6 py-2.5 font-semibold text-[#f5ebe0] hover:opacity-90 cursor-pointer"
              >
                + Start New Project
              </button>
            </section>

            {/* Log Entry Form */}
            <section className="flex w-full flex-col rounded-xl border-2 border-[#d4a373] bg-white p-8 shadow-md">
              <header className="mb-4 text-center">
                <h3 className="text-2xl font-bold text-[#1c0d06]">Log a New Entry</h3>
                <p className="text-xs text-[#7a5230]">
                  Customize field names and choose appropriate input data types for your logging
                  needs.
                </p>
              </header>

              <form onSubmit={handleQuickLog} className="flex flex-col gap-5">
                {/* Field 1: Date */}
                <article className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1c0d06] uppercase tracking-wide">
                    1. Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
                    required
                  />
                </article>

                {/* Field 2: Select Project */}
                <article className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#1c0d06] uppercase tracking-wide">
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
                </article>

                {/* Dynamic Custom Content Fields */}
                {customFields.map((field, index) => {
                  const duration = parseDuration(field.value);

                  return (
                    <article
                      key={field.id}
                      className="flex flex-col gap-2 border-t border-[#d4a373]/20 pt-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                          <span className="text-xs font-bold text-[#7a5230] uppercase shrink-0">
                            {index + 3}. Name:
                          </span>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              handleCustomFieldChange(field.id, 'label', e.target.value)
                            }
                            className="w-full rounded border border-[#d4a373] bg-white px-2 py-1 text-xs font-bold text-[#1c0d06] focus:outline-none focus:ring-1 focus:ring-[#d4a373]"
                            placeholder="Field label..."
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="text-[10px] font-bold uppercase text-[#7a5230]">
                            Type:
                          </label>
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
                        </div>
                      </div>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          placeholder={`Enter ${field.label}...`}
                          value={field.value}
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, 'value', e.target.value)
                          }
                          className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none resize-y min-h-[70px]"
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
                                const m = duration.mins || '0';
                                handleCustomFieldChange(field.id, 'value', `${h || '0'}h ${m}m`);
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
                                let m = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                                if (isNaN(m)) m = 0;
                                if (m > 59) m = 59;
                                const h = duration.hours || '0';
                                handleCustomFieldChange(field.id, 'value', `${h}h ${m}m`);
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
                          onChange={(e) =>
                            handleCustomFieldChange(field.id, 'value', e.target.value)
                          }
                          className="w-full rounded-md border border-[#d4a373] bg-[#f5ebe0] px-4 py-2 text-sm font-semibold text-[#1c0d06] focus:outline-none"
                        />
                      )}
                    </article>
                  );
                })}

                <button
                  type="submit"
                  disabled={projectsList.length === 0}
                  className="mt-2 w-full rounded-md bg-[#1c0d06] py-3 text-sm font-bold text-[#f5ebe0] hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  Save Log Entry
                </button>
              </form>
            </section>
          </section>
        </section>
      </section>

      {/* Pop-Up Modal for Creating a New Project */}
      {isProjectModalOpen && (
        <aside className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <article className="w-full max-w-md rounded-xl border-2 border-[#d4a373] bg-[#f5ebe0] p-6 shadow-2xl text-[#1c0d06]">
            <header className="flex items-center justify-between border-b border-[#d4a373]/40 pb-3">
              <h3 className="text-xl font-bold text-[#1c0d06]">Create New Project</h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="text-lg font-bold text-[#1c0d06] cursor-pointer"
              >
                ✕
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
                  onClick={() => setIsProjectModalOpen(false)}
                  className="rounded-md border border-[#d4a373] px-4 py-2 text-xs font-bold text-[#1c0d06] hover:bg-[#e6c687] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#1c0d06] px-5 py-2 text-xs font-bold text-[#f5ebe0] hover:opacity-90 cursor-pointer"
                >
                  Create Project
                </button>
              </footer>
            </form>
          </article>
        </aside>
      )}
    </main>
  );
};

export default DashboardPage;
