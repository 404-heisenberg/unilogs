import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EntriesPage from './EntriesPage';
import type { Entry, Project } from '@/types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock } };
});

const PROJECTS: Project[] = [
  { id: 1, name: 'Thesis', archived: false, userId: 'u1', reminderFrequency: 'WEEKLY' },
  { id: 2, name: 'Gym Log', archived: false, userId: 'u1', reminderFrequency: 'WEEKLY' },
];

const PAST_DUE_DATE = '2020-01-01T00:00:00.000Z';

const ENTRIES: Entry[] = [
  {
    id: 10,
    projectId: 1,
    date: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    title: 'Literature review notes',
    content: { Notes: 'Read chapter 3', timeSpent: '2h 30m' },
    isCompleted: true,
  },
  {
    id: 11,
    projectId: 2,
    date: '2026-09-02T10:00:00.000Z',
    createdAt: '2026-09-02T10:00:00.000Z',
    content: { Reps: 12 },
    isCompleted: false,
  },
  {
    id: 12,
    projectId: 1,
    date: '2026-09-03T10:00:00.000Z',
    createdAt: '2026-09-03T10:00:00.000Z',
    title: 'Overdue task',
    dueDate: PAST_DUE_DATE,
    isCompleted: false,
    content: {
      text: 'Test entry content',
    },
  },
];

function mockApi(entries: Entry[] = ENTRIES, projects: Project[] = PROJECTS) {
  getMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/entries')) {
      return Promise.resolve({ entries, total: entries.length, page: 1, limit: 50 });
    }
    if (path.startsWith('/api/projects')) return Promise.resolve(projects);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EntriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntriesPage', () => {
  it('shows empty state when no entries exist', async () => {
    mockApi([]);

    renderPage();

    expect(await screen.findByText('No entries recorded yet.')).toBeInTheDocument();
    const createBtn = screen.getByRole('link', { name: 'Create First Entry' });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveAttribute('href', '/entries/new');
  });

  it('shows error state when fetching entries fails', async () => {
    getMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/entries')) return Promise.reject(new Error('network error'));
      if (path.startsWith('/api/projects')) return Promise.resolve(PROJECTS);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    expect(
      await screen.findByText('Failed to load entries. Please refresh to try again.'),
    ).toBeInTheDocument();
  });

  it('renders entries with headlines, snippets, time spent, and project badges', async () => {
    mockApi(ENTRIES);

    renderPage();

    expect(await screen.findByText('Literature review notes')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Thesis/ })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Gym Log/ })).toBeInTheDocument();
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('filters entries client-side using top header search input', async () => {
    mockApi(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    const searchInput = screen.getByPlaceholderText('Search entries...');
    await userEvent.type(searchInput, 'Literature');

    expect(screen.getByText('Literature review notes')).toBeInTheDocument();
    expect(screen.queryByText('Reps: 12')).not.toBeInTheDocument();
  });

  it('filters entries by project using project select dropdown', async () => {
    mockApi(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '2');

    expect(getMock).toHaveBeenCalledWith(expect.stringContaining('projectId=2'));
  });

  it('filters entries by status using Unfinished chip', async () => {
    mockApi(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    const unfinishedChip = screen.getByRole('button', { name: /Unfinished/i });
    await userEvent.click(unfinishedChip);

    expect(screen.queryByText('Literature review notes')).not.toBeInTheDocument();
    expect(screen.getByText('Reps: 12')).toBeInTheDocument();
  });

  it('filters and highlights overdue entries using Overdue status chip', async () => {
    mockApi(ENTRIES);

    renderPage();
    await screen.findByText('Overdue task');

    const overdueChip = screen.getByRole('button', { name: /Overdue/i });
    await userEvent.click(overdueChip);

    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    expect(screen.getByText(/Overdue · due/i)).toBeInTheDocument();
    expect(screen.queryByText('Literature review notes')).not.toBeInTheDocument();
  });

  it('shows no-matches state and clears all active filters', async () => {
    mockApi(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    const searchInput = screen.getByPlaceholderText('Search entries...');
    await userEvent.type(searchInput, 'nonexistentquery');

    expect(await screen.findByText('No entries match the selected filters.')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: 'Clear filters' });
    await userEvent.click(clearBtn);

    expect(await screen.findByText('Literature review notes')).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });
});
