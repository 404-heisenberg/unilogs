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
          <Route path="/projects" element={<p>Projects list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectCreatePage', () => {
  it('creates a project and navigates to the projects list', async () => {
    postMock.mockResolvedValue({ id: 1, name: 'Thesis', archived: false, userId: 'u1' });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('e.g. Gym'), 'Thesis');
    await userEvent.type(
      screen.getByPlaceholderText("What's this project for?"),
      'Final year research',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save project' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects', {
      name: 'Thesis',
      description: 'Final year research',
    });
    expect(await screen.findByText('Projects list')).toBeInTheDocument();
  });

  it('shows an error message when creation fails', async () => {
    postMock.mockRejectedValue(new Error('Failed to create project'));

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('e.g. Gym'), 'Thesis');
    await userEvent.click(screen.getByRole('button', { name: 'Save project' }));

    expect(await screen.findByText('Failed to create project')).toBeInTheDocument();
  });
});
