import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectCreatePage from './ProjectCreatePage';

// Hoist both GET and POST mocks so background queries don't stall network requests
const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: getMock,
      post: postMock,
    },
  };
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

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
  // Ensure background GET requests resolve immediately with empty data
  getMock.mockResolvedValue([]);
});

describe('ProjectCreatePage', () => {
  it('creates a project with a template field set and navigates to it', async () => {
    const user = userEvent.setup();

    postMock.mockImplementation((path: string) => {
      if (path === '/api/projects') {
        return Promise.resolve({
          id: 1,
          name: 'Thesis',
          description: 'Final year research',
          archived: false,
          userId: 'u1',
        });
      }
      if (path === '/api/field-definitions') {
        return Promise.resolve({ id: 1, projectId: 1, name: 'Time spent', fieldType: 'duration' });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    renderPage();

    // Step 1: Details
    await user.type(screen.getByPlaceholderText('e.g. Data Structures Revision'), 'Thesis');
    await user.type(
      screen.getByPlaceholderText('e.g. Weekly problem sets and past-paper drills'),
      'Final year research',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Fields (Select Template)
    expect(await screen.findByRole('button', { name: /Study log/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Study log/ }));

    // Use getAllByText to avoid multiple match errors across template list & tags
    expect(screen.getAllByText(/Time spent/)[0]).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Save
    expect(await screen.findByText('Reminders')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert API interactions & navigation
    expect(postMock).toHaveBeenCalledWith('/api/projects', {
      name: 'Thesis',
      description: 'Final year research',
      color: '#3e6b48',
      reminder: 'weekly',
    });
    expect(postMock).toHaveBeenCalledWith('/api/field-definitions', {
      projectId: 1,
      name: 'Time spent',
      fieldType: 'duration',
    });
    expect(await screen.findByText('Project detail')).toBeInTheDocument();
  }, 10000); // 10s timeout allowance for multi-step jsdom interactions

  it('allows adding custom fields and saving the project', async () => {
    const user = userEvent.setup();

    postMock.mockImplementation((path: string) => {
      if (path === '/api/projects') {
        return Promise.resolve({ id: 2, name: 'Journal', archived: false, userId: 'u1' });
      }
      if (path === '/api/field-definitions') {
        return Promise.resolve({ id: 1, projectId: 2, name: 'Notes', fieldType: 'text' });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    renderPage();

    // Step 1: Details
    await user.type(screen.getByPlaceholderText('e.g. Data Structures Revision'), 'Journal');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Fields (Add Custom Field)
    await user.click(await screen.findByRole('button', { name: 'Add field' }));
    await user.type(screen.getByPlaceholderText('Field name'), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Save
    expect(await screen.findByText('Reminders')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(postMock).toHaveBeenCalledWith('/api/projects', {
      name: 'Journal',
      description: undefined,
      color: '#3e6b48',
      reminder: 'weekly',
    });
    expect(postMock).toHaveBeenCalledWith('/api/field-definitions', {
      projectId: 2,
      name: 'Notes',
      fieldType: 'text',
    });
    expect(await screen.findByText('Project detail')).toBeInTheDocument();
  }, 10000);

  it('shows an error message when creation fails', async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValue(new Error('Failed to create project'));

    renderPage();

    // Step 1: Details
    await user.type(screen.getByPlaceholderText('e.g. Data Structures Revision'), 'Thesis');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Fields
    await user.click(await screen.findByRole('button', { name: /Study log/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Save
    expect(await screen.findByText('Reminders')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to create project')).toBeInTheDocument();
  }, 10000);
});
