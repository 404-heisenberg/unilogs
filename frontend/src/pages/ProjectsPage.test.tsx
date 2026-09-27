import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage from './ProjectsPage';
import type { Project } from '@/types';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock, post: postMock } };
});

const ACTIVE_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Thesis',
    description: 'Final year research',
    archived: false,
    userId: 'u1',
    reminderFrequency: 'WEEKLY',
  },
];

function mockProjects(active: Project[], archived: Project[] = []) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/projects?archived=true') return Promise.resolve(archived);
    if (path === '/api/projects') return Promise.resolve(active);
    const summary = path.match(/^\/api\/projects\/(\d+)\/summary$/);
    if (summary) {
      return Promise.resolve({
        projectId: Number(summary[1]),
        name: 'Thesis',
        entryCount: 18,
        trackedTimeMinutes: 3840,
        lastLoggedAt: null,
        entriesThisWeek: 3,
      });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectsPage', () => {
  it('shows an empty state with no projects', async () => {
    mockProjects([]);

    renderPage();

    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first project' })).toBeInTheDocument();
  });

  it('shows an error state when projects fail to load', async () => {
    getMock.mockRejectedValue(new Error('network error'));

    renderPage();

    expect(
      await screen.findByText('Failed to load projects. Try refreshing the page.'),
    ).toBeInTheDocument();
  });

  it('lists projects with their description', async () => {
    mockProjects(ACTIVE_PROJECTS);

    renderPage();

    expect(await screen.findByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Final year research')).toBeInTheDocument();
  });

  it("shows each project's entry count and tracked time", async () => {
    mockProjects(ACTIVE_PROJECTS);

    renderPage();

    expect(await screen.findByText('18 entries · 64h tracked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thesis' })).toHaveAttribute('href', '/projects/1');
  });

  it('switches to the archived projects view', async () => {
    mockProjects(ACTIVE_PROJECTS, [
      { id: 2, name: 'Old Project', archived: true, userId: 'u1', reminderFrequency: 'WEEKLY' },
    ]);

    renderPage();
    await screen.findByText('Thesis');

    expect(await screen.findByText('1 archived project')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(await screen.findByText('Old Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
  });

  it('unarchives a project from the archived view', async () => {
    mockProjects(ACTIVE_PROJECTS, [
      { id: 2, name: 'Old Project', archived: true, userId: 'u1', reminderFrequency: 'WEEKLY' },
    ]);
    postMock.mockResolvedValue({});

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'View' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Unarchive' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects/2/unarchive');
  });
});
