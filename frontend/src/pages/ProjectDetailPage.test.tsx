import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import type { Entry, FieldDefinition, Project } from '@/types';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock, post: postMock, delete: deleteMock } };
});

const PROJECT: Project = {
  id: 1,
  name: 'Thesis',
  description: 'Final year research',
  archived: false,
  userId: 'u1',
};
const FIELDS: FieldDefinition[] = [{ id: 1, projectId: 1, name: 'Notes', fieldType: 'text' }];
const ENTRIES: Entry[] = [
  {
    id: 5,
    projectId: 1,
    date: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    content: { Notes: 'Read chapter 3' },
  },
  {
    id: 6,
    projectId: 2,
    date: '2026-09-02T00:00:00.000Z',
    createdAt: '2026-09-02T00:00:00.000Z',
    content: { Reps: 12 },
  },
];

function mockData({
  project = PROJECT,
  fields = FIELDS,
  entries = ENTRIES,
}: { project?: Project; fields?: FieldDefinition[]; entries?: Entry[] } = {}) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/projects/1') return Promise.resolve(project);
    if (path === '/api/field-definitions?projectId=1') return Promise.resolve(fields);
    if (path === '/api/entries') return Promise.resolve(entries);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/1']}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectDetailPage', () => {
  it('renders the project, its fields, and only its own entries', async () => {
    mockData();

    renderPage();

    expect(await screen.findByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Final year research')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Notes')).toBeInTheDocument();
    expect(await screen.findByText('Read chapter 3')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('shows an empty state when the project has no fields', async () => {
    mockData({ fields: [] });

    renderPage();

    expect(
      await screen.findByText(
        'No fields yet. Add your first field below to define what an entry for this project looks like.',
      ),
    ).toBeInTheDocument();
  });

  it('adds a new field', async () => {
    mockData();
    postMock.mockResolvedValue({ id: 2, projectId: 1, name: 'Hours', fieldType: 'number' });

    renderPage();
    await screen.findByText('Thesis');

    await userEvent.type(screen.getByPlaceholderText('e.g. Time spent'), 'Hours');
    await userEvent.click(screen.getByRole('button', { name: 'Add field' }));

    expect(postMock).toHaveBeenCalledWith('/api/field-definitions', {
      projectId: 1,
      name: 'Hours',
      fieldType: 'text',
    });
  });

  it('deletes a field', async () => {
    mockData();
    deleteMock.mockResolvedValue(undefined);

    renderPage();
    await screen.findByText('Thesis');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteMock).toHaveBeenCalledWith('/api/field-definitions/1');
  });

  it('shows an error state when entries fail to load', async () => {
    getMock.mockImplementation((path: string) => {
      if (path === '/api/projects/1') return Promise.resolve(PROJECT);
      if (path === '/api/field-definitions?projectId=1') return Promise.resolve(FIELDS);
      if (path === '/api/entries') return Promise.reject(new Error('network error'));
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    expect(
      await screen.findByText('Failed to load entries. Try refreshing the page.'),
    ).toBeInTheDocument();
  });
});
