import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const ENTRIES: Entry[] = [
  {
    id: 10,
    projectId: 1,
    date: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    title: 'Literature review notes',
    content: { Notes: 'Read chapter 3' },
  },
  {
    id: 11,
    projectId: 2,
    date: '2026-09-02T00:00:00.000Z',
    createdAt: '2026-09-02T00:00:00.000Z',
    content: { Reps: 12 },
  },
];

// The real backend filters server-side (title/body/project name, via the `q`
// query param) — this mock does the same narrow matching so the search test
// exercises the real request/response cycle rather than pretending the page
// still filters client-side.
function mockEntries(entries: Entry[], projects: Project[] = PROJECTS) {
  getMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/entries')) {
      const query = new URLSearchParams(path.split('?')[1] ?? '');
      const q = query.get('q')?.toLowerCase();
      const filtered = q
        ? entries.filter((e) => (e.title ?? '').toLowerCase().includes(q))
        : entries;
      return Promise.resolve({ entries: filtered, total: filtered.length, page: 1, limit: 50 });
    }
    if (path.startsWith('/api/projects')) return Promise.resolve(projects);
    if (path === '/api/tags') return Promise.resolve([]);
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
  it('shows an empty state with no entries', async () => {
    mockEntries([]);

    renderPage();

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log your first entry' })).toBeInTheDocument();
  });

  it('shows an error state when entries fail to load', async () => {
    getMock.mockImplementation((path: string) => {
      if (path.startsWith('/api/entries')) return Promise.reject(new Error('network error'));
      if (path.startsWith('/api/projects')) return Promise.resolve(PROJECTS);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    expect(
      await screen.findByText('Failed to load entries. Try refreshing the page.'),
    ).toBeInTheDocument();
  });

  it('lists entries grouped by date, with their project name', async () => {
    mockEntries(ENTRIES);

    renderPage();

    expect(await screen.findByText('Literature review notes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Thesis/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gym Log/ })).toBeInTheDocument();
  });

  it('filters entries by search term via the Filters sheet', async () => {
    mockEntries(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = screen.getByRole('dialog');
    await userEvent.type(within(sheet).getByLabelText('Search entries'), 'Literature');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('Literature review notes')).toBeInTheDocument();
    expect(screen.queryByText('Reps: 12')).not.toBeInTheDocument();
  });

  it('shows a clear-filters action when a filter matches nothing', async () => {
    mockEntries(ENTRIES);

    renderPage();
    await screen.findByText('Literature review notes');

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = screen.getByRole('dialog');
    await userEvent.type(within(sheet).getByLabelText('Search entries'), 'nonexistent');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('No entries match your filters.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Literature review notes')).toBeInTheDocument();
  });
});
