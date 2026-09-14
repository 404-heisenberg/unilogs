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
  { id: 1, name: 'Thesis', archived: false, userId: 'u1' },
  { id: 2, name: 'Gym Log', archived: false, userId: 'u1' },
];

const ENTRIES: Entry[] = [
  {
    id: 10,
    projectId: 1,
    date: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
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

function mockEntries(entries: Entry[], projects: Project[] = PROJECTS) {
  getMock.mockImplementation((path: string) => {
    if (path === '/api/entries') return Promise.resolve(entries);
    if (path === '/api/projects') return Promise.resolve(projects);
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
      if (path === '/api/entries') return Promise.reject(new Error('network error'));
      if (path === '/api/projects') return Promise.resolve(PROJECTS);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage();

    expect(
      await screen.findByText('Failed to load entries. Try refreshing the page.'),
    ).toBeInTheDocument();
  });

  it('lists entries with their project name', async () => {
    mockEntries(ENTRIES);

    renderPage();

    expect(await screen.findByText('Read chapter 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thesis' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gym Log' })).toBeInTheDocument();
  });

  it('filters entries by search term', async () => {
    mockEntries(ENTRIES);

    renderPage();
    await screen.findByText('Read chapter 3');

    await userEvent.type(screen.getByLabelText('Search entries'), 'chapter');

    expect(screen.getByText('Read chapter 3')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('shows a clear-filters action when a filter matches nothing', async () => {
    mockEntries(ENTRIES);

    renderPage();
    await screen.findByText('Read chapter 3');

    await userEvent.type(screen.getByLabelText('Search entries'), 'nonexistent');

    expect(await screen.findByText('No entries match your filters.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Read chapter 3')).toBeInTheDocument();
  });
});
