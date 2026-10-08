import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EntriesAsAtPage from './EntriesAsAtPage';
import type { AsAtEntry } from '@/types';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: getMock },
    // The real helper closes over the unmocked `api`, so route it here.
    getEntriesAsAt: (date: string) => getMock(`/api/entries/as-at?date=${date}`),
  };
});

const ENTRIES: AsAtEntry[] = [
  {
    id: 10,
    projectId: 1,
    title: 'Register interference graph',
    body: 'Old wording of the analysis',
    content: {},
    date: '2026-09-08T12:00:00.000Z',
    project: { id: 1, name: 'Thesis Research' },
    tags: [{ tag: { id: 3, name: 'compilers' } }],
  },
  {
    id: 11,
    projectId: 2,
    title: 'Deleted later',
    body: null,
    content: {},
    date: '2026-09-07T12:00:00.000Z',
    project: { id: 2, name: 'Personal Diary' },
    tags: [],
  },
];

function mockAsAt(entries: AsAtEntry[]) {
  getMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/entries/as-at')) {
      const date = new URLSearchParams(path.split('?')[1]).get('date');
      return Promise.resolve({ entries, total: entries.length, date });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

function renderPage(path = '/entries/as-at') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <EntriesAsAtPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function asAtCalls() {
  return getMock.mock.calls
    .map(([path]) => path as string)
    .filter((path) => path.startsWith('/api/entries/as-at'));
}

describe('EntriesAsAtPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('defaults to today', async () => {
    mockAsAt([]);
    renderPage();

    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    expect(await screen.findByText(/Nothing had been logged by/)).toBeInTheDocument();
    expect(asAtCalls()).toEqual([`/api/entries/as-at?date=${today}`]);
    expect(screen.getByLabelText('Show the logbook as it stood on')).toHaveValue(today);
  });

  it('shows the reconstructed entries grouped by day, under a read-only banner', async () => {
    mockAsAt(ENTRIES);
    renderPage('/entries/as-at?date=2026-09-08');

    expect(await screen.findByText('Register interference graph')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Viewing your logbook as it stood on 8 Sep 2026',
    );
    expect(screen.getByRole('heading', { name: '8 Sep 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7 Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('Deleted later')).toBeInTheDocument();
    expect(screen.getByText('compilers')).toBeInTheDocument();
  });

  it('offers no way to open, edit or delete an entry', async () => {
    mockAsAt(ENTRIES);
    renderPage('/entries/as-at?date=2026-09-08');

    await screen.findByText('Register interference graph');
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(within(card).queryByRole('link')).toBeNull();
      expect(within(card).queryByRole('button')).toBeNull();
    }
  });

  it('refetches once for a newly picked date', async () => {
    mockAsAt(ENTRIES);
    renderPage('/entries/as-at?date=2026-09-08');
    await screen.findByText('Register interference graph');

    fireEvent.change(screen.getByLabelText('Show the logbook as it stood on'), {
      target: { value: '2026-09-01' },
    });

    expect(await screen.findByText(/as it stood on 1 Sep 2026/)).toBeInTheDocument();
    expect(asAtCalls()).toEqual([
      '/api/entries/as-at?date=2026-09-08',
      '/api/entries/as-at?date=2026-09-01',
    ]);
  });

  it('links back to the live timeline', async () => {
    mockAsAt([]);
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to current entries' })).toHaveAttribute(
      'href',
      '/entries',
    );
  });

  it('shows an error when the reconstruction fails', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    renderPage('/entries/as-at?date=2026-09-08');

    expect(
      await screen.findByText(/Failed to load your logbook for 8 Sep 2026/),
    ).toBeInTheDocument();
  });
});
