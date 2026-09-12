import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ProjectsPage from './ProjectsPage';
import type { Project } from '@/types';

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock, post: postMock, patch: patchMock } };
});

const ACTIVE_PROJECTS: Project[] = [
  { id: 1, name: 'Thesis', description: 'Final year research', archived: false, userId: 'u1' },
];

function mockProjects(active: Project[], archived: Project[] = []) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/projects?archived=true') return Promise.resolve(archived);
    if (path === '/api/projects') return Promise.resolve(active);
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

  it('edits a project name and saves the change', async () => {
    mockProjects(ACTIVE_PROJECTS);
    patchMock.mockResolvedValue({ ...ACTIVE_PROJECTS[0], name: 'Thesis v2' });

    renderPage();
    await screen.findByText('Thesis');

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Project name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Thesis v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(patchMock).toHaveBeenCalledWith('/api/projects/1', {
      name: 'Thesis v2',
      description: 'Final year research',
    });
  });

  it('archives a project', async () => {
    mockProjects(ACTIVE_PROJECTS);
    postMock.mockResolvedValue({ ...ACTIVE_PROJECTS[0], archived: true });

    renderPage();
    await screen.findByText('Thesis');

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects/1/archive');
  });

  it('switches to the archived projects view', async () => {
    mockProjects(ACTIVE_PROJECTS, [{ id: 2, name: 'Old Project', archived: true, userId: 'u1' }]);

    renderPage();
    await screen.findByText('Thesis');

    await userEvent.click(screen.getByRole('button', { name: 'Show archived projects' }));

    expect(await screen.findByText('Old Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument();
  });
});
