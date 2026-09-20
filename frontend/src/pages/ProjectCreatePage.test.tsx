import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectCreatePage from './ProjectCreatePage';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, post: postMock } };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route path="/projects/new" element={<ProjectCreatePage />} />
          <Route path="/projects/:projectId" element={<p>Project detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectCreatePage', () => {
  it('creates a project with a template field set and navigates to it', async () => {
    postMock.mockImplementation((path: string) => {
      if (path === '/api/projects')
        return Promise.resolve({ id: 1, name: 'Thesis', archived: false, userId: 'u1' });
      if (path === '/api/field-definitions')
        return Promise.resolve({ id: 1, projectId: 1, name: 'x', fieldType: 'text' });
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('e.g. Gym'), 'Thesis');
    await userEvent.type(
      screen.getByPlaceholderText("What's this project for?"),
      'Final year research',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Study log')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Study log/ }));
    expect(screen.getByText('Time spent — duration')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Review')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects', {
      name: 'Thesis',
      description: 'Final year research',
    });
    expect(postMock).toHaveBeenCalledWith('/api/field-definitions', {
      projectId: 1,
      name: 'Time spent',
      fieldType: 'duration',
    });
    expect(await screen.findByText('Project detail')).toBeInTheDocument();
  });

  it('allows creating a project with no fields via the Blank template', async () => {
    postMock.mockResolvedValue({ id: 2, name: 'Journal', archived: false, userId: 'u1' });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('e.g. Gym'), 'Journal');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create project' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects', {
      name: 'Journal',
      description: undefined,
    });
    expect(postMock).not.toHaveBeenCalledWith('/api/field-definitions', expect.anything());
    expect(await screen.findByText('Project detail')).toBeInTheDocument();
  });

  it('shows an error message when creation fails', async () => {
    postMock.mockRejectedValue(new Error('Failed to create project'));

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('e.g. Gym'), 'Thesis');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Failed to create project')).toBeInTheDocument();
  });
});
