import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EntriesPage from './EntriesPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

const ENTRIES = [
  {
    id: '1',
    title: 'Initial Entry',
    body: 'Completed initial setup and configuration.',
    date: new Date().toISOString(),
    projectId: 1,
    tags: [
      {
        tag: {
          id: 101,
          name: 'dev',
          usageCount: 1,
        },
      },
    ],
  },
];

const PROJECTS = [{ id: 1, name: 'Main Project', color: '#3b82f6' }];

type MockEntry = (typeof ENTRIES)[number];
type MockProject = (typeof PROJECTS)[number];

function mockApi(entries: MockEntry[] = ENTRIES, projects: MockProject[] = PROJECTS) {
  getMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/entries')) {
      return Promise.resolve({ entries, total: entries.length, page: 1, limit: 50 });
    }
    if (path.startsWith('/api/projects')) return Promise.resolve(projects);
    if (path.startsWith('/api/tags')) return Promise.resolve([]);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EntriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially and resolves entries', async () => {
    mockApi();
    renderWithProviders(<EntriesPage />);

    expect(await screen.findByText('Initial Entry')).toBeInTheDocument();
  });

  it('renders empty state when no entries exist', async () => {
    mockApi([], []);
    renderWithProviders(<EntriesPage />);

    expect(await screen.findByText('No entries recorded yet.')).toBeInTheDocument();
  });
});
